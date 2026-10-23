import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { NumPipe } from '../../../shared/num.pipe';
import {
  InventoryStore, suppliers,
  type POLineItem, type PurchaseOrder,
} from '../../../store/inventory-store';

type Tab = 'active' | 'received' | 'new';

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  Draft:    { bg: '#9B7B5A18', text: '#9B7B5A', border: '#9B7B5A40', label: 'Draft' },
  Sent:     { bg: '#4A7C5920', text: '#4A7C59', border: '#4A7C5950', label: 'Sent to Supplier' },
  Partial:  { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350', label: 'Partially Received' },
  Received: { bg: '#7A3B1E15', text: '#7A3B1E', border: '#7A3B1E40', label: 'Fully Received' },
};

const blankLine = (): POLineItem => ({ ingredientId: '', orderedQty: 0, receivedQty: 0, unitCost: 0 });

@Component({
  selector: 'app-purchase-orders',
  imports: [StaffLayout, FormsModule, NumPipe, NgTemplateOutlet],
  templateUrl: './purchase-orders.html',
})
export class PurchaseOrders {
  private inventory = inject(InventoryStore);
  nav = INVENTORY_NAV;
  suppliers = suppliers;
  statusStyle = STATUS_STYLE;

  tab: Tab = 'active';

  // New PO form state
  supplierId = suppliers[0].id;
  expectedAt = '';
  notes = '';
  lines: POLineItem[] = [blankLine()];
  poCreated = false;

  // Receive modal state
  receivingId: string | null = null;
  received: { ingredientId: string; receivedQty: number }[] = [];

 get purchaseOrders() { return this.inventory.purchaseOrders(); }
  get ingredients() { return this.inventory.ingredients(); }
  get active() { return this.purchaseOrders.filter(p => p.status !== 'Received'); }
  get completed() { return this.purchaseOrders.filter(p => p.status === 'Received'); }
  get receivingPO() { return this.purchaseOrders.find(p => p.id === this.receivingId); }

  get tabs() {
    return [
      { id: 'active' as Tab, label: `Active (${this.active.length})` },
      { id: 'received' as Tab, label: `Received (${this.completed.length})` },
      { id: 'new' as Tab, label: '+ New PO' },
    ];
  }

  get lineTotal() { return this.lines.reduce((s, l) => s + l.orderedQty * l.unitCost, 0); }

  ingredient(id: string) { return this.ingredients.find(g => g.id === id); }
  supplierName(id: string) { return suppliers.find(s => s.id === id)?.name; }
  orderedQty(po: PurchaseOrder, ingredientId: string) {
    return po.lineItems.find(l => l.ingredientId === ingredientId)?.orderedQty ?? 0;
  }

  fmt(d: Date) {
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  addLine() { this.lines = [...this.lines, blankLine()]; }
  removeLine(i: number) { this.lines = this.lines.filter((_, idx) => idx !== i); }

  updateLine(i: number, field: keyof POLineItem, val: string | number | null) {
    this.lines = this.lines.map((ln, idx) => {
      if (idx !== i) return ln;
      const updated = { ...ln, [field]: field !== 'ingredientId' ? +(val ?? 0) : val };
      if (field === 'ingredientId') {
        const ing = this.ingredient(String(val));
        if (ing) updated.unitCost = ing.unitCost;
      }
      return updated;
    });
  }

  handleCreate() {
    const validLines = this.lines.filter(l => l.ingredientId && l.orderedQty > 0);
    if (!validLines.length || !this.expectedAt) return;
    this.inventory.createPO(this.supplierId, validLines, new Date(this.expectedAt), this.notes || undefined);
    this.poCreated = true;
    this.lines = [blankLine()];
    this.notes = '';
    this.expectedAt = '';
    setTimeout(() => { this.poCreated = false; this.tab = 'active'; }, 1200);
  }

  openReceive(po: PurchaseOrder) {
    this.receivingId = po.id;
    this.received = po.lineItems.map(l => ({ ingredientId: l.ingredientId, receivedQty: l.orderedQty }));
  }

  handleReceive() {
    if (!this.receivingId) return;
    this.inventory.receivePO(this.receivingId, this.received.map(r => ({ ...r, receivedQty: +r.receivedQty })));
    this.receivingId = null;
  }

  closeOnBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.receivingId = null;
  }
}