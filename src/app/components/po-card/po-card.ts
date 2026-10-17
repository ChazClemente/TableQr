import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { InventoryStore, type POStatus, type PurchaseOrder } from '../../store/inventory-store';

const STATUS_STYLE: Record<POStatus, { bg: string; text: string; border: string; label: string }> = {
  Draft: { bg: '#9B7B5A18', text: '#9B7B5A', border: '#9B7B5A40', label: 'Draft' },
  Sent: { bg: '#4A7C5920', text: '#4A7C59', border: '#4A7C5950', label: 'Sent to Supplier' },
  Partial: { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350', label: 'Partially Received' },
  Received: { bg: '#7A3B1E15', text: '#7A3B1E', border: '#7A3B1E40', label: 'Fully Received' },
};

@Component({
  selector: 'app-po-card',
  imports: [DatePipe],
  templateUrl: './po-card.html',
})
export class PoCard {
  private store = inject(InventoryStore);

  po = input.required<PurchaseOrder>();
  receive = output<PurchaseOrder>();

  statusStyle = computed(() => STATUS_STYLE[this.po().status]);

  supplierName = computed(() => this.store.suppliers().find(s => s.id === this.po().supplierId)?.name);

  lines = computed(() =>
    this.po().lineItems.map(l => {
      const ing = this.store.ingredients().find(g => g.id === l.ingredientId);
      return {
        ...l,
        name: ing?.name ?? l.ingredientId,
        uom: ing?.uom ?? '',
        subtotal: l.orderedQty * l.unitCost,
      };
    }),
  );
}