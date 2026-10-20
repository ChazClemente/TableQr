import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

// ─── Interfaces ───────────────────────────────────────────────────────────────
export type OrderType = 'dine-in' | 'take-out';
export type BillStatus = 'open' | 'settled' | 'voided';
export type DiscountType = 'none' | 'senior' | 'pwd';
export type PaymentMethod = 'cash' | 'gcash' | 'maya';

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
        subtotal: Number(r.subtotal || 0),
        serviceCharge: 0,
        discountAmount: Number(billData?.discount_amount || 0),
        total: Number(billData?.total_amount || r.subtotal || 0),
        status: r.order_status === 'completed' || billData?.bill_status === 'paid' ? 'settled' : 'open',
        createdAt: new Date(r.created_at || new Date()),
      };
    }));
  }

  async loadTransactions() {
    const { data, error } = await this.sb.from('payment').select('*').order('payment_id', { ascending: false }).limit(500);
    if (error) { console.error("Error loading payments:", error); return; }
    
    this.transactions.set((data ?? []).map((r: any) => ({
      id: r.payment_id, billId: r.bill_id, orderType: 'dine-in', items: [], 
      subtotal: 0, serviceCharge: 0, discountAmount: 0, total: 0, 
      amountTendered: 0, change: 0, paymentMethod: r.payment_method,
      settledAt: new Date(), cashier: 'Cashier 1',
    })));
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

  // ─── Actions ────────────────────────────────────────────────────────────────

  async createBill(
    items: BillItem[],
    orderType: OrderType,
    tableLabel?: string,
    source: Bill['source'] = 'pos',
  ): Promise<Bill> {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    
    // 1. Create Order
    const { data: order, error: orderError } = await this.sb
      .from('orders')
      .insert({
        order_type: orderType,
        order_status: 'pending',
        subtotal,
        table_id: orderType === 'dine-in' ? (tableLabel ? Number(tableLabel.replace(/\D/g, '')) : 1) : null,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    // 2. Create Order Items
    const { error: itemsError } = await this.sb.from('order_item').insert(
      items.map(i => ({
        order_id: order.order_id,
        menu_id: i.menuItemId,
        quantity: i.quantity,
        item_subtotal: i.price * i.quantity,
      })),
    );
    if (itemsError) throw itemsError;

    // 3. Create Bill
    const { error: billError } = await this.sb.from('bill').insert({
      order_id: order.order_id,
      bill_status: 'open',
      total_amount: subtotal,
      discount_amount: 0,
    });
    if (billError) throw billError;

    const bill: Bill = {
      id: order.order_id, orderType, tableLabel, source, items,
      subtotal, serviceCharge: 0, discountAmount: 0, total: subtotal,
      status: 'open', createdAt: new Date(),
    };
    
    this.bills.update(prev => [bill, ...prev]);
    return bill;
  }

  async settleBill(billId: string, amountTendered: number, paymentMethod: PaymentMethod): Promise<Transaction | null> {
    const bill = this.bills().find(b => b.id === billId && b.status === 'open');
    if (!bill) return null;

    await this.sb.from('orders').update({ order_status: 'completed' }).eq('order_id', billId);
    await this.sb.from('bill').update({ bill_status: 'paid' }).eq('order_id', billId);

    const { data: payment, error } = await this.sb.from('payment').insert({
      bill_id: billId, payment_method: paymentMethod, payment_status: 'completed',
    }).select().single();
    
    if (error) throw error;

    const tx: Transaction = {
      id: payment.payment_id, billId, orderType: bill.orderType, tableLabel: bill.tableLabel,
      items: bill.items, subtotal: bill.subtotal, serviceCharge: 0, discountAmount: 0, total: bill.total,
      amountTendered, change: Math.max(0, amountTendered - bill.total), paymentMethod,
      settledAt: new Date(), cashier: 'Cashier 1',
    };

    this.transactions.update(prev => [tx, ...prev]);
    this.bills.update(prev => prev.map(b => (b.id === billId ? { ...b, status: 'settled' as const } : b)));
    return tx;
  }

  async applyDiscount(
    billId: string,
    input: { type: DiscountType; customerName?: string; idNumber?: string; cardData?: string; appliedBy?: string },
  ) {
    const { data, error } = await this.sb.rpc('apply_discount', {
      p_bill_id: billId,
      p_type: input.type,
      p_customer_name: input.customerName ?? null,
      p_id_number: input.idNumber ?? null,
      p_card_data: input.cardData ?? null,
      p_applied_by: input.appliedBy ?? 'Cashier 1',
    });
    if (error) throw error;
    
    // Reload bills and audit trail to reflect the new discount
    this.loadOpenBills(); 
    this.loadDiscountAudit();
  }

  async removeDiscount(billId: string, removedBy = 'Cashier 1') {
    const { data, error } = await this.sb.rpc('remove_discount', {
      p_bill_id: billId,
      p_removed_by: removedBy,
    });
    if (error) throw error;
    
    this.loadOpenBills();
    this.loadDiscountAudit();
  }

  // Stubs for Day Closing to prevent compile errors
  async loadCashDrawer() {}
  async loadClosings() {}
  async closeDay(actualCash: number, closedBy = 'Cashier 1') { 
    alert('Day Closing is disabled.');
    throw new Error('Disabled');
  }
}