import { Component, computed, inject, signal } from '@angular/core';
import { InventoryLayout } from '../../../components/inventory-layout/inventory-layout';
import { StockBar } from '../../../components/stock-bar/stock-bar';
import { InventoryStore, type IngredientCategory, type StockStatus } from '../../../store/inventory-store';

const CAT_EMOJI: Record<IngredientCategory, string> = {
  'Proteins': '🥩', 'Produce': '🥬', 'Dry Goods': '🌾',
  'Condiments & Seasonings': '🧂', 'Dairy & Eggs': '🥚', 'Packaging': '📦',
};

const STATUS_STYLE: Record<StockStatus, { bg: string; text: string; border: string; bar: string; label: string }> = {
  Good: { bg: '#4A7C5918', text: '#4A7C59', border: '#4A7C5940', bar: '#4A7C59', label: '✓ Good' },
  Low: { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350', bar: '#D4A843', label: '⚠ Low' },
  Critical: { bg: '#C0392B18', text: '#C0392B', border: '#C0392B40', bar: '#C0392B', label: '🔴 Critical' },
};

@Component({
  selector: 'app-stock-monitor',
  imports: [InventoryLayout, StockBar],
  templateUrl: './stock-monitor.html',
})
export class StockMonitor {
  private store = inject(InventoryStore);

  catEmoji = CAT_EMOJI;
  statusStyle = STATUS_STYLE;
  filters: (StockStatus | 'All')[] = ['All', 'Good', 'Low', 'Critical'];

  filterStatus = signal<StockStatus | 'All'>('All');

  // every ingredient with its status and numbers worked out once
  items = computed(() =>
    this.store.ingredients().map(ing => ({
      ing,
      status: this.store.stockStatus(ing),
      supplierName: this.store.suppliers().find(s => s.id === ing.supplierId)?.name.split(' ')[0] ?? '—',
      pctOfReorder: (ing.currentStock / (ing.reorderPoint || 1)) * 100,
      need: Math.max(0, ing.reorderPoint - ing.currentStock),
    })),
  );

  visible = computed(() => this.items().filter(i => this.filterStatus() === 'All' || i.status === this.filterStatus()));

  counts = computed<Record<StockStatus | 'All', number>>(() => {
    const all = this.items();
    return {
      All: all.length,
      Good: all.filter(i => i.status === 'Good').length,
      Low: all.filter(i => i.status === 'Low').length,
      Critical: all.filter(i => i.status === 'Critical').length,
    };
  });

  criticalNames = computed(() => this.items().filter(i => i.status === 'Critical').map(i => i.ing.name));
  lowNames = computed(() => this.items().filter(i => i.status === 'Low').map(i => i.ing.name));
}