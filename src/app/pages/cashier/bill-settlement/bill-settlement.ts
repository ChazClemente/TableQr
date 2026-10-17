import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { QRCodeComponent } from 'angularx-qrcode';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { BillCard } from '../../../components/bill-card/bill-card';
import { CashierStore, type PaymentMethod } from '../../../store/cashier-store';
import { KitchenStore } from '../../../store/kitchen-store';
import { InventoryStore } from '../../../store/inventory-store';
import type { Category } from '../../../data/menu';

@Component({
  selector: 'app-bill-settlement',
  imports: [CashierLayout, BillCard, QRCodeComponent, DatePipe],
  templateUrl: './bill-settlement.html',
})
export class BillSettlement {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(CashierStore);
  private kitchen = inject(KitchenStore);
  private inventory = inject(InventoryStore);

  methods: { id: PaymentMethod; label: string }[] = [
    { id: 'cash', label: '💵 Cash' },
    { id: 'gcash', label: '💙 GCash' },
    { id: 'maya', label: '💚 Maya' },
  ];

  drawer = this.store.cashDrawer;
  openBills = computed(() => this.store.bills().filter(b => b.status === 'open'));

  // ?highlight=BILL-xxx  (from POS)
  private highlighted = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('highlight'))),
    { initialValue: this.route.snapshot.queryParamMap.get('highlight') },
  );

  selectedId = signal<string | null>(this.highlighted() ?? this.openBills()[0]?.id ?? null);
  selected = computed(() => this.openBills().find(b => b.id === this.selectedId()) ?? null);

  tendered = signal('');
  method = signal<PaymentMethod>('cash');
  settled = signal<{ change: number; txnId: string } | null>(null);
  showQrModal = signal(false);
  saving = signal(false);
  settleError = signal<string | null>(null);

  tenderedNum = computed(() => parseFloat(this.tendered()) || 0);
  isDigital = computed(() => this.method() === 'gcash' || this.method() === 'maya');
  effectiveTendered = computed(() => (this.isDigital() ? (this.selected()?.total ?? 0) : this.tenderedNum()));
  change = computed(() => {
    const sel = this.selected();
    return sel ? Math.max(0, this.effectiveTendered() - sel.total) : 0;
  });
  canSettle = computed(() => {
    const sel = this.selected();
    return !!sel && (this.isDigital() || this.tenderedNum() >= sel.total);
  });

  quickAmounts = computed(() => {
    const sel = this.selected();
    if (!sel) return [];
    return [
      sel.total,
      Math.ceil(sel.total / 100) * 100,
      Math.ceil(sel.total / 500) * 500,
      Math.ceil(sel.total / 1000) * 1000,
    ].filter((v, i, a) => a.indexOf(v) === i);
  });

  qrValue = computed(() => {
    const sel = this.selected();
    if (!sel) return '';
    const app = this.method() === 'gcash' ? 'gcash' : 'maya';
    return `${app}://pay?amount=${sel.total.toFixed(2)}&ref=${sel.id}&merchant=KainanKayAlingNene`;
  });

  constructor() {
    // replaces useEffect(() => { if (highlighted) setSelectedId(highlighted) }, [highlighted])
    effect(() => {
      const h = this.highlighted();
      if (h) this.selectBill(h);
    });
  }

  // replaces the useEffect that reset the form whenever selectedId changed
  selectBill(id: string | null) {
    this.selectedId.set(id);
    this.tendered.set('');
    this.settled.set(null);
    this.method.set('cash');
  }

  onTendered(e: Event) {
    this.tendered.set((e.target as HTMLInputElement).value);
  }

  quickTender(amt: number) {
    this.tendered.set(String(amt));
  }

  goToDiscount(billId: string) {
    this.router.navigate(['/cashier/discount'], { queryParams: { bill: billId } });
  }

  onMainAction() {
    if (this.isDigital()) this.showQrModal.set(true);
    else this.handleSettle();
  }

  async confirmDigital() {
  await this.handleSettle();
  this.showQrModal.set(false);
}

async handleSettle() {
  const sel = this.selected();
  if (!sel || !this.canSettle() || this.saving()) return;

  this.saving.set(true);
  this.settleError.set(null);
  try {
    const tx = await this.store.settleBill(sel.id, this.effectiveTendered(), this.method());
    if (!tx) return;

    // Dispatch to kitchen only after payment is confirmed (still in-memory for now)
    if (sel.source === 'pos') {
      this.kitchen.addTicket({
        id: `TKT-${sel.id}`,
        orderId: sel.id,
        tableLabel: sel.tableLabel ?? sel.orderType,
        source: 'pos',
        status: 'preparing',
        receivedAt: new Date(),
        items: sel.items.map(i => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          category: i.category as Category,
        })),
      });
    }

    this.inventory.deductStockForBill(
      sel.id,
      sel.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    );

    this.settled.set({ change: tx.change, txnId: tx.id });

    setTimeout(() => {
      this.settled.set(null);
      const remaining = this.store.bills().filter(b => b.status === 'open' && b.id !== sel.id);
      this.selectBill(remaining[0]?.id ?? null);
      this.router.navigate(['/cashier/bills']);
    }, 2500);
  } catch (e) {
    console.error(e);
    this.settleError.set('Could not settle the bill. Please try again.');
  } finally {
    this.saving.set(false);
  }
}}