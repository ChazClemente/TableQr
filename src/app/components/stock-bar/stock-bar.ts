import { Component, computed, input } from '@angular/core';
import type { Ingredient } from '../../store/inventory-store';

@Component({
  selector: 'app-stock-bar',
  templateUrl: './stock-bar.html',
})
export class StockBar {
  ing = input.required<Ingredient>();
  color = input.required<string>();

  // the bar's full width = 2x the reorder point
  private max = computed(() => this.ing().reorderPoint * 2 || 1);

  pct = computed(() => Math.min(100, (this.ing().currentStock / this.max()) * 100));
  safetyLeft = computed(() => Math.min(100, (this.ing().safetyStock / this.max()) * 100));
  reorderLeft = computed(() => Math.min(100, (this.ing().reorderPoint / this.max()) * 100));
}