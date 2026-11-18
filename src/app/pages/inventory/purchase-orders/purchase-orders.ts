import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InventoryStore,
  POLineItem,
  POStatus,
  ReceiveEntry,
  VarianceResult,
} from '../../../store/inventory-store';

type Tab = 'active' | 'received' | 'new';

interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [StaffLayout, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './purchase-orders.html',
  styleUrl: './purchase-orders.css',
})
export class PurchaseOrders {
  nav = INVENTORY_NAV;
  private inv = inject(InventoryStore);

  readonly suppliers = this.inv.suppliers();
  readonly ingredients = this.inv.ingredients;
  readonly purchaseOrders = this.inv.purchaseOrders;

  readonly STATUS_STYLE: Record<POStatus, StatusStyle> = {
    Draft:    { bg: '#9B7B5A18', text: '#9B7B5A', border: '#9B7B5A40', label: 'Draft' },
    Sent:     { bg: '#4A7C5920', text: '#4A7C59', border: '#4A7C5950', label: 'Sent to Supplier' },
    Partial:  { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350', label: 'Partially Received' },
    Received: { bg: '#7A3B1E15', text: '#7A3B1E', border: '#7A3B1E40', label: 'Fully Received' },
  };

  readonly tab = signal<Tab>('active');

  readonly active = computed(() => this.purchaseOrders().filter((p) => p.status !== 'Received'));
  readonly completed = computed(() => this.purchaseOrders().filter((p) => p.status === 'Received'));
  readonly shown = computed(() => (this.tab() === 'active' ? this.active() : this.completed()));

  // ---------- New PO form ----------
  readonly supplierId = signal(this.suppliers[0].id);
  readonly expectedAt = signal('');
  readonly notes = signal('');
  readonly lines = signal<POLineItem[]>([this.blankLine()]);
  readonly poCreated = signal(false);
  readonly formError = signal('');

  readonly lineTotal = computed(() =>
    this.lines().reduce((s, l) => s + l.orderedQty * l.unitCost, 0)
  );

  // ---------- Receive modal ----------
  readonly receivingId = signal<string | null>(null);
  readonly receivedQtys = signal<number[]>([]);
  /** Pre-delivery physical count per line (null = not counted). */
  readonly physicalCounts = signal<(number | null)[]>([]);
  /** Set after confirming; switches the modal to the results view. */
  readonly receiveResults = signal<VarianceResult[] | null>(null);

  readonly receivingPO = computed(() =>
    this.purchaseOrders().find((p) => p.id === this.receivingId()) ?? null
  );

  readonly flaggedCount = computed(
    () => (this.receiveResults() ?? []).filter((r) => r.flagged).length
  );

  private blankLine(): POLineItem {
    return { ingredientId: '', orderedQty: 0, receivedQty: 0, unitCost: 0 };
  }

  // ---------- Helpers ----------
  getIng(id: string) {
    return this.ingredients().find((i) => i.id === id);
  }

  supplierName(id: string): string {
    return this.suppliers.find((s) => s.id === id)?.name ?? id;
  }

  style(s: POStatus): StatusStyle {
    return this.STATUS_STYLE[s];
  }

  resultFor(lineIndex: number): VarianceResult | undefined {
    return this.receiveResults()?.find((r) => r.lineIndex === lineIndex);
  }

  // ---------- Form handlers ----------
  addLine() {
    this.lines.update((l) => [...l, this.blankLine()]);
  }

  removeLine(i: number) {
    this.lines.update((l) => l.filter((_, idx) => idx !== i));
  }

  updateLine(i: number, field: keyof POLineItem, val: string | number | null) {
    this.lines.update((list) =>
      list.map((ln, idx) => {
        if (idx !== i) return ln;
        const updated: POLineItem = {
          ...ln,
          [field]: field === 'ingredientId' ? String(val ?? '') : Number(val) || 0,
        };
        if (field === 'ingredientId') {
          const ing = this.getIng(String(val));
          if (ing) updated.unitCost = ing.unitCost;
        }
        return updated;
      })
    );
  }

  handleCreate() {
    const valid = this.lines().filter((l) => l.ingredientId && l.orderedQty > 0);
    if (!valid.length) {
      this.formError.set('Add at least one ingredient with a quantity.');
      return;
    }
    if (!this.expectedAt()) {
      this.formError.set('Please choose an expected delivery date.');
      return;
    }
    this.formError.set('');

    this.inv.createPO(
      this.supplierId(),
      valid,
      new Date(this.expectedAt()),
      this.notes().trim() || undefined
    );

    this.poCreated.set(true);
    this.lines.set([this.blankLine()]);
    this.notes.set('');
    this.expectedAt.set('');

    setTimeout(() => {
      this.poCreated.set(false);
      this.tab.set('active');
    }, 1200);
  }

  // ---------- Receive handlers ----------
  openReceive(poId: string) {
    const po = this.purchaseOrders().find((p) => p.id === poId);
    if (!po) return;
    this.receiveResults.set(null);
    this.receivingId.set(poId);
    this.receivedQtys.set(po.lineItems.map((l) => Math.max(0, l.orderedQty - l.receivedQty)));
    this.physicalCounts.set(po.lineItems.map(() => null));
  }

  setReceived(i: number, val: string | number | null) {
    this.receivedQtys.update((arr) => arr.map((q, idx) => (idx === i ? Number(val) || 0 : q)));
  }

  setPhysical(i: number, val: string | number | null) {
    const n = val === null || val === '' ? null : Number(val);
    const ok = n !== null && Number.isFinite(n) && n >= 0;
    this.physicalCounts.update((arr) => arr.map((v, idx) => (idx === i ? (ok ? n : null) : v)));
  }

  closeReceive() {
    this.receivingId.set(null);
    this.receiveResults.set(null);
  }

  handleReceive() {
    const id = this.receivingId();
    if (!id) return;
    const entries: ReceiveEntry[] = this.receivedQtys().map((qty, i) => ({
      qty,
      physicalCount: this.physicalCounts()[i] ?? null,
    }));
    this.receiveResults.set(this.inv.receivePOWithCount(id, entries));
  }
}