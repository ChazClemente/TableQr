import { Component, computed, inject, signal } from '@angular/core';
import { InventoryLayout } from '../../../components/inventory-layout/inventory-layout';
import { PoCard } from '../../../components/po-card/po-card';
import { InventoryStore, type POLineItem, type PurchaseOrder } from '../../../store/inventory-store';

type Tab = 'active' | 'received' | 'new';

const blankLine = (): POLineItem => ({ ingredientId: '', orderedQty: 0, receivedQty: 0, unitCost: 0 });

@Component({
  selector: 'app-purchase-orders',
  imports: [InventoryLayout, PoCard],
  templateUrl: './purchase-orders.html',
})
export class PurchaseOrders {
  private store = inject(InventoryStore);

  purchaseOrders = this.store.purchaseOrders;
  ingredients = this.store.ingredients;
  suppliers = this.store.suppliers;

  tab = signal<Tab>('active');

  // New PO form state
  supplierId = signal(this.store.suppliers()[0]?.id ?? '');
  expectedAt = signal('');
  notes = signal('');
  lines = signal<POLineItem[]>([blankLine()]);
  poCreated = signal(false);

  // Receive modal state
  receivingId = signal<string | null>(null);
  received = signal<{ ingredientId: string; receivedQty: number }[]>([]);

  active = computed(() => this.purchaseOrders().filter(p => p.status !== 'Received'));
  completed = computed(() => this.purchaseOrders().filter(p => p.status === 'Received'));

  tabs = computed(() => [
    { id: 'active' as Tab, label: `Active (${this.active().length})` },
    { id: 'received' as Tab, label: `Received (${this.completed().length})` },
    { id: 'new' as Tab, label: '+ New PO' },
  ]);

  lineTotal = computed(() => this.lines().reduce((s, l) => s + l.orderedQty * l.unitCost, 0));

  canCreate = computed(
    () => !!this.expectedAt() && this.lines().some(l => l.ingredientId && l.orderedQty > 0),
  );

  // ─── receive modal ───────────────────────────────────────────────────────────
  receivingPo = computed(() => this.purchaseOrders().find(p => p.id === this.receivingId()) ?? null);

  receiveRows = computed(() => {
    const po = this.receivingPo();
    if (!po) return [];
    return this.received().map((r, i) => {
      const line = po.lineItems.find(l => l.ingredientId === r.ingredientId);
      const ing = this.ingredients().find(g => g.id === r.ingredientId);
      return {
        i,
        name: ing?.name ?? r.ingredientId,
        uom: ing?.uom ?? '',
        ordered: line?.orderedQty ?? 0,
        already: line?.receivedQty ?? 0,
        qty: r.receivedQty,
      };
    });
  });

  // ─── new PO form ─────────────────────────────────────────────────────────────
  onSupplier(e: Event) {
    this.supplierId.set((e.target as HTMLSelectElement).value);
  }

  onExpected(e: Event) {
    this.expectedAt.set((e.target as HTMLInputElement).value);
  }

  onNotes(e: Event) {
    this.notes.set((e.target as HTMLTextAreaElement).value);
  }

  addLine() {
    this.lines.update(l => [...l, blankLine()]);
  }

  removeLine(i: number) {
    this.lines.update(l => l.filter((_, idx) => idx !== i));
  }

  // picking an ingredient also fills in its unit cost
  onIngredient(i: number, e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    const ing = this.ingredients().find(g => g.id === id);
    this.lines.update(ls =>
      ls.map((ln, idx) => (idx !== i ? ln : { ...ln, ingredientId: id, unitCost: ing ? ing.unitCost : ln.unitCost })),
    );
  }

  onQty(i: number, e: Event) {
    const v = +(e.target as HTMLInputElement).value;
    this.lines.update(ls => ls.map((ln, idx) => (idx === i ? { ...ln, orderedQty: v } : ln)));
  }

  onCost(i: number, e: Event) {
    const v = +(e.target as HTMLInputElement).value;
    this.lines.update(ls => ls.map((ln, idx) => (idx === i ? { ...ln, unitCost: v } : ln)));
  }

  handleCreate() {
    const validLines = this.lines().filter(l => l.ingredientId && l.orderedQty > 0);
    if (!validLines.length || !this.expectedAt()) return;

    this.store.createPO(this.supplierId(), validLines, new Date(this.expectedAt()), this.notes() || undefined);

    this.poCreated.set(true);
    this.lines.set([blankLine()]);
    this.notes.set('');
    this.expectedAt.set('');
    setTimeout(() => {
      this.poCreated.set(false);
      this.tab.set('active');
    }, 1200);
  }

  // ─── receive actions ─────────────────────────────────────────────────────────
  openReceive(po: PurchaseOrder) {
    this.receivingId.set(po.id);
    // default = what's still missing, so receiving twice never double counts
    this.received.set(
      po.lineItems.map(l => ({
        ingredientId: l.ingredientId,
        receivedQty: Math.max(0, l.orderedQty - l.receivedQty),
      })),
    );
  }

  closeReceive() {
    this.receivingId.set(null);
  }

  onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.closeReceive();
  }

  onReceivedQty(i: number, e: Event) {
    const v = +(e.target as HTMLInputElement).value;
    this.received.update(prev => prev.map((x, j) => (j === i ? { ...x, receivedQty: v } : x)));
  }

  handleReceive() {
    const id = this.receivingId();
    if (!id) return;
    this.store.receivePO(id, this.received());
    this.closeReceive();
  }
}