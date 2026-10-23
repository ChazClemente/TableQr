import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type OrderType = 'dine-in' | 'take-out';
export type BillStatus = 'open' | 'settled' | 'voided';
export type DiscountType = 'none' | 'senior' | 'pwd';
export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'qr payment';

export interface DiningTable {
  id: number;
  number: string;
}

export interface BillItem {
  menuItemId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

export interface DiscountRecord {
  type: DiscountType;
  label: string;
  idNumber?: string;
  customerName?: string;
  cardData?: string;
  percent: number;
  appliedAt: Date;
  appliedBy: string;
}

export interface Transaction {
  id: string;
  billId: string;
  orderType: OrderType;
  tableLabel?: string;
  items: BillItem[];
  subtotal: number;
  serviceCharge: number;
  discount?: DiscountRecord;
  discountAmount: number;
  total: number;
  amountTendered: number;
  change: number;
  paymentMethod: PaymentMethod;
  settledAt: Date;
  cashier: string;
}

export interface Bill {
  id: string;
  orderType: OrderType;
  tableLabel?: string;
  source: 'pos' | 'qr' | 'cash-request';
  items: BillItem[];
  subtotal: number;
  serviceCharge: number;
  discount?: DiscountRecord;
  discountAmount: number;
  total: number;
  status: BillStatus;
  createdAt: Date;
  note?: string;
}

export interface CashDrawer {
  balance: number;
  openingBalance: number;
  transactions: { amount: number; type: 'in' | 'out'; note: string; at: Date }[];
}

export interface DiscountCatalogEntry {
  type: DiscountType;
  label: string;
  percent: number;
  needsId: boolean;
}

export interface DiscountAuditEntry {
  id: number;
  billId: string;
  action: 'applied' | 'removed';
  type: string;
  label: string;
  percent: number;
  amount: number;
  customerName?: string;
  idNumber?: string;
  cardData?: string;
  appliedBy: string;
  at: Date;
  tableLabel?: string;
}

export interface DayClosing {
  businessDate: string;
  totalTransactions: number;
  grossSales: number;
  totalDiscounts: number;
  serviceCharges: number;
  netSales: number;
  cashSales: number;
  ewalletSales: number;
  openingBalance: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
  openBills: number;
  closedBy: string;
  closedAt: Date;
}

const manilaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// ─── Store (Angular service) ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CashierStore {
  private sb = inject(SupabaseService).client;

  readonly bills = signal<Bill[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly tables = signal<DiningTable[]>([]);
  
  readonly cashDrawer = signal<CashDrawer>({ balance: 5000, openingBalance: 5000, transactions: [] });
  
  readonly discountCatalog = signal<DiscountCatalogEntry[]>([]);
  readonly discountAudit = signal<DiscountAuditEntry[]>([]);
  
  readonly closings = signal<DayClosing[]>([]);
  readonly todayClosing = computed(() => this.closings().find(c => c.businessDate === manilaToday()) ?? null);

  readonly dailySummary = computed(() => {
    const today = new Date();
    const todayTxns = this.transactions().filter(t => t.settledAt.toDateString() === today.toDateString());
    const totalSales = todayTxns.reduce((s, t) => s + t.total, 0);
    const totalCash = todayTxns.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + t.total, 0);
    const totalEwallet = todayTxns.filter(t => t.paymentMethod !== 'cash').reduce((s, t) => s + t.total, 0);
    const totalDiscounts = todayTxns.reduce((s, t) => s + t.discountAmount, 0);
    const expectedDrawer = this.cashDrawer().openingBalance + totalCash;
    return { todayTxns, totalSales, totalCash, totalEwallet, totalDiscounts, expectedDrawer };
  });

  constructor() {
    this.loadOpenBills();
    this.loadTransactions();
    this.loadTables();
    this.loadDiscountCatalog();
    this.loadDiscountAudit();
    this.loadClosings();
  }

  // ─── Loaders ────────────────────────────────────────────────────────────────

  async loadTables() {
    const { data, error } = await this.sb.from('tables').select('*').eq('table_status', 'active');
    if (error) { console.error("Error loading tables:", error); return; }
    
    this.tables.set((data ?? []).map((t: any) => ({
      id: t.table_id,
      number: t.table_number
    })));
  }

  async loadOpenBills() {
    const { data, error } = await this.sb
      .from('orders')
      .select(`
        order_id, order_type, order_status, subtotal, table_id, created_at,
        bill ( bill_status, total_amount, discount_amount ),
        order_item ( menu_id, quantity, item_subtotal, menu ( menu_name, menu_category ) )
      `)
      .neq('order_status', 'completed');

    if (error) { console.error("Error loading orders:", error); return; }
    
    this.bills.set((data ?? []).map((r: any) => {
      const billData = Array.isArray(r.bill) ? r.bill[0] : r.bill;
      const table = this.tables().find(t => t.id === r.table_id);

      const subtotal = Number(r.subtotal || 0);
      const discountAmount = Number(billData?.discount_amount || 0);
      const serviceCharge = Math.round(subtotal * 0.05);
      const dbTotal = Number(billData?.total_amount || (subtotal + serviceCharge));

      return {
        id: r.order_id,
        orderType: r.order_type === 'dine-in' ? 'dine-in' : 'take-out',
        tableLabel: table ? table.number : (r.table_id ? `Table ${r.table_id}` : undefined),
        source: 'pos',
        items: (r.order_item || []).map((i: any) => ({
          menuItemId: String(i.menu_id),
          name: i.menu?.menu_name || 'Unknown Item',
          category: i.menu?.menu_category || 'Ulam',
          price: i.quantity > 0 ? Number(i.item_subtotal) / i.quantity : 0,
          quantity: i.quantity,
        })),
        subtotal: subtotal,
        serviceCharge: serviceCharge,
        discountAmount: discountAmount,
        discount: discountAmount > 0 ? {
          type: 'senior', label: 'Discount', percent: 20, appliedAt: new Date(), appliedBy: 'Cashier'
        } : undefined,
        total: dbTotal,
        status: r.order_status === 'completed' || billData?.bill_status === 'paid' ? 'settled' : 'open',
        createdAt: new Date(r.created_at || new Date()),
      };
    }));
  }

  async loadTransactions() {
    const { data, error } = await this.sb
      .from('payment')
      .select(`
        *,
        bill (
          order_id,
          discount_amount,
          orders (
            order_type, subtotal, created_at,
            order_item ( menu_id, quantity, item_subtotal, menu ( menu_name, menu_category ) )
          )
        )
      `)
      .order('payment_id', { ascending: false })
      .limit(500);

    if (error) { console.error("Error loading payments:", error); return; }
    
    this.transactions.set((data ?? []).map((r: any) => {
      const billData = Array.isArray(r.bill) ? r.bill[0] : r.bill;
      const orderData = Array.isArray(billData?.orders) ? billData.orders[0] : billData?.orders;
      
      const items = (orderData?.order_item || []).map((i: any) => ({
        menuItemId: String(i.menu_id),
        name: i.menu?.menu_name || 'Unknown Item',
        category: i.menu?.menu_category || 'Ulam',
        price: i.quantity > 0 ? Number(i.item_subtotal) / i.quantity : 0,
        quantity: i.quantity,
      }));

      const dbSubtotal = Number(orderData?.subtotal || 0);
      const discountAmount = Number(billData?.discount_amount || 0);
      
      const foodPrice = dbSubtotal; 
      const serviceCharge = Math.round(foodPrice * 0.05);
      const finalTotal = foodPrice + serviceCharge - discountAmount;

      const paidDate = r.paid_at ? new Date(r.paid_at) : new Date(orderData?.created_at || new Date());

      return {
        id: String(r.payment_id), 
        billId: String(r.bill_id), 
        orderType: orderData?.order_type === 'dine-in' ? 'dine-in' : 'take-out',
        tableLabel: undefined,
        items: items, 
        subtotal: foodPrice,         
        serviceCharge: serviceCharge, 
        discountAmount: discountAmount, 
        total: finalTotal,           
        amountTendered: finalTotal, 
        change: 0, 
        paymentMethod: r.payment_method === 'cash' ? 'cash' : 'qr payment',
        settledAt: paidDate, 
        cashier: 'Cashier 1',
      };
    }));
  }

  async loadDiscountCatalog() {
    const { data, error } = await this.sb.from('discount_types').select('*').eq('active', true);
    if (error) { console.error("Error loading discount types:", error); return; }
    
    this.discountCatalog.set((data ?? []).map((d: any) => ({
      type: d.type,
      label: d.label,
      percent: Number(d.percent),
      needsId: d.needs_id
    })));
  }

  async loadDiscountAudit() {
    const { data, error } = await this.sb
      .from('discount_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) { console.error("Error loading discount audit:", error); return; }
    
    this.discountAudit.set((data ?? []).map((r: any) => ({
      id: r.id,
      billId: r.bill_id,
      action: r.action,
      type: r.discount_type,
      label: r.label,
      percent: Number(r.percent),
      amount: Number(r.amount),
      customerName: r.customer_name,
      idNumber: r.id_number,
      cardData: r.card_data,
      appliedBy: r.applied_by,
      at: new Date(r.created_at),
    })));
  }

  async loadClosings() {
    const { data, error } = await this.sb
      .from('day_closings')
      .select('*')
      .order('business_date', { ascending: false })
      .limit(30);
    if (error) { console.error("Error loading closings:", error); return; }
    
    this.closings.set((data ?? []).map((r: any) => ({
      businessDate: r.business_date,
      totalTransactions: r.total_transactions,
      grossSales: Number(r.gross_sales),
      totalDiscounts: Number(r.total_discounts),
      serviceCharges: Number(r.service_charges),
      netSales: Number(r.net_sales),
      cashSales: Number(r.cash_sales),
      ewalletSales: Number(r.ewallet_sales),
      openingBalance: Number(r.opening_balance),
      expectedCash: Number(r.expected_cash),
      actualCash: Number(r.actual_cash),
      discrepancy: Number(r.discrepancy),
      openBills: r.open_bills,
      closedBy: r.closed_by,
      closedAt: new Date(r.created_at || new Date()),
    })));
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  async createBill(
    items: BillItem[],
    orderType: OrderType,
    tableLabel?: string,
    source: Bill['source'] = 'pos',
  ): Promise<Bill> {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const serviceCharge = Math.round(subtotal * 0.05);
    const total = subtotal + serviceCharge;
    
    const { data: order, error: orderError } = await this.sb
      .from('orders')
      .insert({
        order_type: orderType,
        order_status: 'pending',
        subtotal,
        table_id: orderType === 'take-out' ? 1 : (tableLabel ? Number(tableLabel.replace(/\D/g, '')) : 1),
      })
      .select()
      .single();
      
    if (orderError) throw orderError;

    const { error: itemsError } = await this.sb.from('order_item').insert(
      items.map(i => ({
        order_id: order.order_id,
        menu_id: i.menuItemId,
        quantity: i.quantity,
        item_subtotal: i.price * i.quantity,
      })),
    );
    if (itemsError) throw itemsError;

    const { error: billError } = await this.sb.from('bill').insert({
      order_id: order.order_id,
      bill_status: 'open',
      total_amount: total,
      discount_amount: 0,
    });
    if (billError) throw billError;

    const bill: Bill = {
      id: order.order_id, orderType, tableLabel, source, items,
      subtotal, serviceCharge, discountAmount: 0, total,
      status: 'open', createdAt: new Date(),
    };
    
    this.bills.update(prev => [bill, ...prev]);
    return bill;
  }

  async updateBillItems(billId: string, items: BillItem[], tableLabel?: string) {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const serviceCharge = Math.round(subtotal * 0.05);
    const total = subtotal + serviceCharge;

    await this.sb.from('order_item').delete().eq('order_id', billId);

    const { error: itemsError } = await this.sb.from('order_item').insert(
      items.map(i => ({
        order_id: billId,
        menu_id: i.menuItemId,
        quantity: i.quantity,
        item_subtotal: i.price * i.quantity,
      })),
    );
    if (itemsError) throw itemsError;

    await this.sb.from('orders').update({ subtotal }).eq('order_id', billId);
    await this.sb.from('bill').update({ total_amount: total }).eq('order_id', billId);

    await this.loadOpenBills();
  }

  async settleBill(billId: string, amountTendered: number, paymentMethod: PaymentMethod): Promise<Transaction | null> {
    const bill = this.bills().find(b => b.id === billId && b.status === 'open');
    if (!bill) return null;

    const { data: billData, error: findError } = await this.sb
      .from('bill')
      .select('bill_id')
      .eq('order_id', billId)
      .single();

    if (findError || !billData) throw new Error("Bill not found");

    const actualBillId = billData.bill_id;
    const now = new Date().toISOString();

    await this.sb.from('orders').update({ order_status: 'completed' }).eq('order_id', billId);
    await this.sb.from('bill').update({ bill_status: 'paid' }).eq('bill_id', actualBillId);

    const { data: payment, error } = await this.sb.from('payment').insert({
      bill_id: actualBillId, 
      payment_method: paymentMethod, 
      payment_status: 'completed',
      paid_at: now
    }).select().single();
    
    if (error) throw error;

    const tx: Transaction = {
      id: payment.payment_id, 
      billId: billId, 
      orderType: bill.orderType, 
      tableLabel: bill.tableLabel,
      items: bill.items, 
      subtotal: bill.subtotal, 
      serviceCharge: bill.serviceCharge, 
      discountAmount: bill.discountAmount, 
      total: bill.total,
      amountTendered, 
      change: Math.max(0, amountTendered - bill.total), 
      paymentMethod,
      settledAt: new Date(now), 
      cashier: 'Cashier 1',
    };

    this.transactions.update(prev => [tx, ...prev]);
    this.bills.update(prev => prev.map(b => (b.id === billId ? { ...b, status: 'settled' as const } : b)));
    return tx;
  }

  async applyDiscount(
    billId: string, 
    input: { type: DiscountType; customerName?: string; idNumber?: string; cardData?: string; appliedBy?: string },
  ) {
    const { data: billData, error: billError } = await this.sb
      .from('bill')
      .select('*')
      .eq('order_id', billId)
      .single();

    if (billError || !billData) throw new Error("Bill not found");

    const { data: orderData } = await this.sb
      .from('orders')
      .select('subtotal')
      .eq('order_id', billId)
      .single();

    const subtotal = Number(orderData?.subtotal || 0);
    const percent = 20; 
    const discountAmount = Math.round((subtotal * percent) / 100);
    const taxBase = subtotal - discountAmount;
    const newServiceCharge = Math.round(taxBase * 0.05);
    const newTotal = taxBase + newServiceCharge;

    const { error: updateError } = await this.sb
      .from('bill')
      .update({ 
        discount_amount: discountAmount,
        total_amount: newTotal
      })
      .eq('order_id', billId);

    if (updateError) throw updateError;

    await this.sb.from('discount_audit').insert({
      bill_id: billData.bill_id || billId, 
      action: 'applied',
      discount_type: input.type,
      label: input.type === 'senior' ? 'Senior Citizen' : 'PWD Discount',
      percent: percent,
      amount: discountAmount,
      customer_name: input.customerName ?? null,
      id_number: input.idNumber ?? null,
      card_data: input.cardData ?? null,
      applied_by: input.appliedBy ?? 'Cashier 1'
    });

    await this.loadOpenBills(); 
    await this.loadDiscountAudit();
  }

  async removeDiscount(billId: string, removedBy = 'Cashier 1') {
    const { data: billData, error: billError } = await this.sb
      .from('bill')
      .select('*')
      .eq('order_id', billId)
      .single();

    if (billError || !billData) throw new Error("Bill not found");

    const { data: orderData } = await this.sb
      .from('orders')
      .select('subtotal')
      .eq('order_id', billId)
      .single();

    const subtotal = Number(orderData?.subtotal || 0);
    const newServiceCharge = Math.round(subtotal * 0.05);
    const newTotal = subtotal + newServiceCharge;
    
    const { error: updateError } = await this.sb
      .from('bill')
      .update({ 
        discount_amount: 0,
        total_amount: newTotal
      })
      .eq('order_id', billId);

    if (updateError) throw updateError;

    await this.sb.from('discount_audit').insert({
      bill_id: billData.bill_id || billId,
      action: 'removed',
      discount_type: 'none',
      label: 'Discount Removed',
      percent: 0,
      amount: 0,
      applied_by: removedBy
    });

    await this.loadOpenBills();
    await this.loadDiscountAudit();
  }

  async closeDay(actualCash: number, closedBy = 'Cashier 1'): Promise<DayClosing> {
    const summary = this.dailySummary();
    const dateStr = new Date().toLocaleDateString('en-CA'); 
    const expected = summary.expectedDrawer;
    const discrepancy = actualCash - expected;

    // 1. Save to Supabase
    const { data, error } = await this.sb.from('day_closings').insert({
      business_date: dateStr,
      total_transactions: summary.todayTxns.length,
      gross_sales: summary.totalSales + summary.totalDiscounts,
      total_discounts: summary.totalDiscounts,
      service_charges: summary.todayTxns.reduce((s, t) => s + t.serviceCharge, 0),
      net_sales: summary.totalSales,
      cash_sales: summary.totalCash,
      ewallet_sales: summary.totalEwallet,
      opening_balance: this.cashDrawer().openingBalance,
      expected_cash: expected,
      actual_cash: actualCash,
      discrepancy: discrepancy,
      open_bills: this.bills().filter(b => b.status === 'open').length,
      closed_by: closedBy,
    }).select().single();

    if (error) {
      console.error("Failed to close day:", error);
      throw error;
    }

    // 2. Return the formatted result to the UI
    const closing: DayClosing = {
      businessDate: dateStr,
      totalTransactions: summary.todayTxns.length,
      grossSales: summary.totalSales + summary.totalDiscounts,
      totalDiscounts: summary.totalDiscounts,
      serviceCharges: summary.todayTxns.reduce((s, t) => s + t.serviceCharge, 0),
      netSales: summary.totalSales,
      cashSales: summary.totalCash,
      ewalletSales: summary.totalEwallet,
      openingBalance: this.cashDrawer().openingBalance,
      expectedCash: expected,
      actualCash: actualCash,
      discrepancy: discrepancy,
      openBills: this.bills().filter(b => b.status === 'open').length,
      closedBy: closedBy,
      closedAt: new Date(),
    };

    // 3. Add to local state
    this.closings.update(prev => [closing, ...prev]);
    return closing;
  }
}