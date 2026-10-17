import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

function toBill(r: any): Bill {
  return {
    id: r.id,
    orderType: r.order_type,
    tableLabel: r.table_label ?? undefined,
    source: r.source,
    items: r.bill_items.map((i: any) => ({
      menuItemId: i.menu_item_id,
      name: i.name,
      category: i.category,
      price: Number(i.price),
      quantity: i.quantity,
    })),
    subtotal: Number(r.subtotal),
    serviceCharge: Number(r.service_charge),
    discount: toDiscount(r.discount),
    discountAmount: Number(r.discount_amount),
    total: Number(r.total),
    status: r.status,
    createdAt: new Date(r.created_at),
    note: r.note ?? undefined,
  };
}

const toBillItem = (i: any): BillItem => ({
  menuItemId: i.menu_item_id,
  name: i.name,
  category: i.category,
  price: Number(i.price),
  quantity: i.quantity,
});

// discount is stored as jsonb, so the date comes back as a string
const toDiscount = (d: any): DiscountRecord | undefined =>
  d ? { ...d, appliedAt: new Date(d.appliedAt) } : undefined;

function toTransaction(r: any, items?: BillItem[]): Transaction {
  return {
    id: r.id,
    billId: r.bill_id,
    orderType: r.order_type,
    tableLabel: r.table_label ?? undefined,
    items: items ?? (r.bills?.bill_items ?? []).map(toBillItem),
    subtotal: Number(r.subtotal),
    serviceCharge: Number(r.service_charge),
    discount: toDiscount(r.discount),
    discountAmount: Number(r.discount_amount),
    total: Number(r.total),
    amountTendered: Number(r.amount_tendered),
    change: Number(r.change_amount),
    paymentMethod: r.payment_method,
    settledAt: new Date(r.settled_at),
    cashier: r.cashier,
  };
}

// "YYYY-MM-DD" in Philippine time
const manilaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

export type OrderType = 'dine-in' | 'take-out';
export type BillStatus = 'open' | 'settled' | 'voided';
export type DiscountType = 'none' | 'senior' | 'pwd';
export type PaymentMethod = 'cash' | 'gcash' | 'maya';

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
  cardData?: string; // extra card fields (age, disability type, etc.)
  percent: number; // e.g. 20 for 20%
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

// ─── Discount catalog ─────────────────────────────────────────────────────────

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

function toDayClosing(r: any): DayClosing {
  return {
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
    closedAt: new Date(r.closed_at),
  };
}

function toAuditEntry(r: any): DiscountAuditEntry {
  return {
    id: r.id,
    billId: r.bill_id,
    action: r.action,
    type: r.discount_type,
    label: r.label,
    percent: Number(r.percent),
    amount: Number(r.amount),
    customerName: r.customer_name ?? undefined,
    idNumber: r.id_number ?? undefined,
    cardData: r.card_data ?? undefined,
    appliedBy: r.applied_by,
    at: new Date(r.created_at),
    tableLabel: r.bills?.table_label ?? r.bills?.order_type ?? undefined,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeTotals(items: BillItem[], discount?: DiscountRecord) {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = discount ? Math.round((subtotal * discount.percent) / 100) : 0;
  const taxBase = subtotal - discountAmount;
  const serviceCharge = Math.round(taxBase * 0.05);
  const total = taxBase + serviceCharge;
  return { subtotal, discountAmount, serviceCharge, total };
}


// ─── Store (Angular service) ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CashierStore {
  private sb = inject(SupabaseService).client;

  readonly bills = signal<Bill[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly cashDrawer = signal<CashDrawer>({ balance: 0, openingBalance: 0, transactions: [] });
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
    this.loadCashDrawer();
    this.loadDiscountCatalog();
    this.loadDiscountAudit();
  }

  // ─── Loaders ────────────────────────────────────────────────────────────────

  async loadOpenBills() {
    const { data, error } = await this.sb
      .from('bills')
      .select('*, bill_items(*)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    this.bills.set((data ?? []).map(toBill));
  }

  async loadTransactions() {
    const { data, error } = await this.sb
      .from('transactions')
      .select('*, bills(bill_items(*))')
      .order('settled_at', { ascending: false })
      .limit(500);
    if (error) { console.error(error); return; }
    this.transactions.set((data ?? []).map(r => toTransaction(r)));
  }

  async loadCashDrawer() {
    const today = manilaToday();

    // make sure today's drawer row exists (opening balance defaults to 5000)
    await this.sb
      .from('cash_drawer_days')
      .upsert({ business_date: today }, { onConflict: 'business_date', ignoreDuplicates: true });

    const [day, moves] = await Promise.all([
      this.sb.from('cash_drawer_days').select('opening_balance').eq('business_date', today).single(),
      this.sb.from('cash_movements').select('*').eq('business_date', today).order('at'),
    ]);
    if (day.error || moves.error) { console.error(day.error ?? moves.error); return; }

    const opening = Number(day.data.opening_balance);
    const list = (moves.data ?? []).map(m => ({
      amount: Number(m.amount),
      type: m.type as 'in' | 'out',
      note: m.note ?? '',
      at: new Date(m.at),
    }));
    const net = list.reduce((s, m) => s + (m.type === 'in' ? m.amount : -m.amount), 0);

    this.cashDrawer.set({ balance: opening + net, openingBalance: opening, transactions: list });
  }

    async loadClosings() {
    const { data, error } = await this.sb
      .from('day_closings')
      .select('*')
      .order('business_date', { ascending: false })
      .limit(30);
    if (error) { console.error(error); return; }
    this.closings.set((data ?? []).map(toDayClosing));
  }

  async closeDay(actualCash: number, closedBy = 'Cashier 1'): Promise<DayClosing> {
    const { data, error } = await this.sb.rpc('close_day', {
      p_actual_cash: actualCash,
      p_closed_by: closedBy,
    });
    if (error) throw error;
    const closing = toDayClosing(data);
    this.closings.update(prev => [closing, ...prev.filter(c => c.businessDate !== closing.businessDate)]);
    return closing;
  }

    async loadDiscountCatalog() {
    const { data, error } = await this.sb
      .from('discount_types')
      .select('*')
      .eq('active', true)
      .order('label');
    if (error) { console.error(error); return; }
    this.discountCatalog.set(
      (data ?? []).map(d => ({
        type: d.type,
        label: d.label,
        percent: Number(d.percent),
        needsId: d.needs_id,
      })),
    );
  }

  async loadDiscountAudit() {
    const { data, error } = await this.sb
      .from('discount_audit')
      .select('*, bills(table_label, order_type)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { console.error(error); return; }
    this.discountAudit.set((data ?? []).map(toAuditEntry));
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  async createBill(
    items: BillItem[],
    orderType: OrderType,
    tableLabel?: string,
    source: Bill['source'] = 'pos',
  ): Promise<Bill> {
    const { subtotal, serviceCharge, total } = computeTotals(items);

    const { data: row, error } = await this.sb
      .from('bills')
      .insert({
        order_type: orderType,
        table_label: tableLabel,
        source,
        subtotal,
        service_charge: serviceCharge,
        discount_amount: 0,
        total,
      })
      .select()
      .single();
    if (error) throw error;

    const { error: itemsError } = await this.sb.from('bill_items').insert(
      items.map(i => ({
        bill_id: row.id,
        menu_item_id: i.menuItemId,
        name: i.name,
        category: i.category,
        price: i.price,
        quantity: i.quantity,
      })),
    );
    if (itemsError) {
      await this.sb.from('bills').delete().eq('id', row.id); // don't leave an empty bill behind
      throw itemsError;
    }

    const bill: Bill = {
      id: row.id, orderType, tableLabel, source, items,
      subtotal, serviceCharge, discountAmount: 0, total,
      status: 'open', createdAt: new Date(row.created_at),
    };
    this.bills.update(prev => [bill, ...prev]);
    return bill;
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
    this.mergeBillRow(billId, data);
    this.loadDiscountAudit();
  }

  async removeDiscount(billId: string, removedBy = 'Cashier 1') {
    const { data, error } = await this.sb.rpc('remove_discount', {
      p_bill_id: billId,
      p_removed_by: removedBy,
    });
    if (error) throw error;
    this.mergeBillRow(billId, data);
    this.loadDiscountAudit();
  }

  // copy the totals the database computed into the local bill
  private mergeBillRow(billId: string, r: any) {
    this.bills.update(prev =>
      prev.map(b =>
        b.id === billId
          ? {
              ...b,
              subtotal: Number(r.subtotal),
              serviceCharge: Number(r.service_charge),
              discountAmount: Number(r.discount_amount),
              total: Number(r.total),
              discount: toDiscount(r.discount),
            }
          : b,
      ),
    );
  }

  async settleBill(
    billId: string,
    amountTendered: number,
    paymentMethod: PaymentMethod,
    cashier = 'Cashier 1',
  ): Promise<Transaction | null> {
    const bill = this.bills().find(b => b.id === billId && b.status === 'open');
    if (!bill) return null;

    const { data, error } = await this.sb.rpc('settle_bill', {
      p_bill_id: billId,
      p_amount_tendered: amountTendered,
      p_payment_method: paymentMethod,
      p_cashier: cashier,
    });
    if (error) throw error;

    const tx = toTransaction(data, bill.items);
    this.transactions.update(prev => [tx, ...prev]);
    this.bills.update(prev => prev.map(b => (b.id === billId ? { ...b, status: 'settled' as const } : b)));

    if (paymentMethod === 'cash') {
      const received = tx.amountTendered - tx.change;
      this.cashDrawer.update(d => ({
        ...d,
        balance: d.balance + received,
        transactions: [
          ...d.transactions,
          {
            amount: received,
            type: 'in' as const,
            note: `Bill ${billId} — ${bill.tableLabel ?? bill.orderType}`,
            at: new Date(),
          },
        ],
      }));
    }

    return tx;
  }
}