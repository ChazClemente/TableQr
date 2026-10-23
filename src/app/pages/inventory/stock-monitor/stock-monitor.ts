import { Component, OnDestroy, inject } from '@angular/core';
import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import {
  InventoryStore, stockStatus, suppliers,
  type Ingredient, type IngredientCategory, type StockStatus,
} from '../../../store/inventory-store';

const CAT_EMOJI: Record<IngredientCategory, string> = {
  'Proteins': '🥩', 'Produce': '🥬', 'Dry Goods': '🌾',
  'Condiments & Seasonings': '🧂', 'Dairy & Eggs': '🥚', 'Packaging': '📦',
};

const STATUS_STYLE: Record<StockStatus, { bg: string; text: string; border: string; bar: string; label: string }> = {
  Good:     { bg: '#4A7C5918', text: '#4A7C59', border: '#4A7C5940', bar: '#4A7C59', label: '✓ Good' },
  Low:      { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350', bar: '#D4A843', label: '⚠ Low' },
  Critical: { bg: '#C0392B18', text: '#C0392B', border: '#C0392B40', bar: '#C0392B', label: '🔴 Critical' },
};

type Filter = StockStatus | 'All';

@Component({
  selector: 'app-stock-monitor',
  imports: [StaffLayout],
  templateUrl: './stock-monitor.html',
})
export class StockMonitor implements OnDestroy {
  private inventory = inject(InventoryStore);
  nav = INVENTORY_NAV;
  catEmoji = CAT_EMOJI;
  statusStyle = STATUS_STYLE;
  stockStatus = stockStatus;
  filters: Filter[] = ['All', 'Good', 'Low', 'Critical'];

  filterStatus: Filter = 'All';
  private iv = setInterval(() => {}, 10000);
  ngOnDestroy() { clearInterval(this.iv); }

  get ingredients() { return this.inventory.ingredients(); }
  get visible() { return this.ingredients.filter(i => this.filterStatus === 'All' || stockStatus(i) === this.filterStatus); }
  get criticals() { return this.ingredients.filter(i => stockStatus(i) === 'Critical'); }
  get lows() { return this.ingredients.filter(i => stockStatus(i) === 'Low'); }

  names(list: Ingredient[]) { return list.map(i => i.name).join(' · '); }
  count(f: Filter) { return f === 'All' ? this.ingredients.length : this.ingredients.filter(i => stockStatus(i) === f).length; }
  filterStyle(f: Filter) { return f !== 'All' ? STATUS_STYLE[f] : null; }
  supplierShort(id: string) { return suppliers.find(s => s.id === id)?.name.split(' ')[0]; }

  // StockBar geometry — scale is 2× the reorder point
  private scale(ing: Ingredient) { return ing.reorderPoint * 2 || 1; }
  barPct(ing: Ingredient) { return Math.min(100, (ing.currentStock / this.scale(ing)) * 100); }
  safetyPct(ing: Ingredient) { return (ing.safetyStock / this.scale(ing)) * 100; }
  reorderPct(ing: Ingredient) { return (ing.reorderPoint / this.scale(ing)) * 100; }
  pctOfReorder(ing: Ingredient) { return ((ing.currentStock / (ing.reorderPoint || 1)) * 100).toFixed(0); }
  need(ing: Ingredient) { return Math.max(0, ing.reorderPoint - ing.currentStock).toFixed(1); }
}