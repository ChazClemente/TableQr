import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { InventoryStore, type VarianceRecord } from '../../../store/inventory-store';

const REASONS: { value: VarianceRecord['reason']; label: string; icon: string }[] = [
  { value: 'spoilage',      label: 'Spoilage',       icon: '🗑' },
  { value: 'shrinkage',     label: 'Shrinkage',      icon: '📉' },
  { value: 'portion_drift', label: 'Portion Drift',  icon: '⚖️' },
  { value: 'theft',         label: 'Theft',          icon: '🔒' },
  { value: 'unaccounted',   label: 'Unaccounted',    icon: '❓' },
];

@Component({
  selector: 'app-variance-engine',
  imports: [StaffLayout, FormsModule],
  templateUrl: './variance-engine.html',
})
export class VarianceEngine {
  private inventory = inject(InventoryStore);
  nav = INVENTORY_NAV;
  reasons = REASONS;

  selectedIngId = '';
  actualQty: string | number = '';
  reason: VarianceRecord['reason'] = 'unaccounted';
  submitted = false;

  get ingredients() { return this.inventory.ingredients(); }
  get varianceRecords() { return this.inventory.varianceRecords(); }

  get selectedIng() { return this.ingredients.find(i => i.id === this.selectedIngId); }
  get theoreticalQty() { return this.selectedIng?.currentStock ?? 0; }
  get actualNum() { return parseFloat(String(this.actualQty)) || 0; }
  get hasActual() { return this.actualQty !== '' && this.actualQty !== null; }
  get variance() { return this.actualNum - this.theoreticalQty; }
  get variancePct() { return this.theoreticalQty > 0 ? (Math.abs(this.variance) / this.theoreticalQty) * 100 : 0; }
  get flagged() { return Math.abs(this.variancePct) > 5; }

  get resultColor() { return this.flagged ? (this.variance < 0 ? '#C0392B' : '#8B6914') : '#4A7C59'; }
  get resultBg() { return this.flagged ? (this.variance < 0 ? '#C0392B12' : '#D4A84312') : '#4A7C5912'; }
  get resultBorder() { return this.flagged ? (this.variance < 0 ? '#C0392B50' : '#D4A84350') : '#4A7C5950'; }

  get flaggedRecords() { return this.varianceRecords.filter(v => v.flagged); }
  get totalVarianceValue() {
    return this.varianceRecords.reduce((s, v) => {
      const ing = this.ingredient(v.ingredientId);
      return s + (ing ? Math.abs(v.variance) * ing.unitCost : 0);
    }, 0);
  }

  get stats() {
    return [
      { label: 'Total Variance Records', value: this.varianceRecords.length, color: '#7A3B1E' },
      { label: 'Flagged (>5% drift)', value: this.flaggedRecords.length, color: '#C0392B' },
      { label: 'Est. Variance Value', value: `₱${this.totalVarianceValue.toFixed(0)}`, color: '#8B6914' },
    ];
  }

  ingredient(id: string) { return this.ingredients.find(i => i.id === id); }
  reasonFor(value: string) { return REASONS.find(r => r.value === value); }
  abs(n: number) { return Math.abs(n); }

  formatDate(d: Date) {
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  selectIngredient(id: string) {
    this.selectedIngId = id;
    this.actualQty = '';
  }

  handleLog() {
    if (!this.selectedIng || !this.hasActual) return;
    this.inventory.logVariance({
      ingredientId: this.selectedIngId,
      date: new Date(),
      theoreticalQty: this.theoreticalQty,
      actualQty: this.actualNum,
      variance: this.variance,
      reason: this.reason,
      flagged: this.flagged,
    });
    this.submitted = true;
    setTimeout(() => { this.submitted = false; this.actualQty = ''; this.selectedIngId = ''; }, 1800);
  }
}