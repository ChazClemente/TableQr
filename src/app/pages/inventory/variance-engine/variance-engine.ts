import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { InventoryLayout } from '../../../components/inventory-layout/inventory-layout';
import { InventoryStore, type VarianceRecord } from '../../../store/inventory-store';

type Reason = VarianceRecord['reason'];

const REASONS: { value: Reason; label: string; icon: string }[] = [
  { value: 'spoilage', label: 'Spoilage', icon: '🗑' },
  { value: 'shrinkage', label: 'Shrinkage', icon: '📉' },
  { value: 'portion_drift', label: 'Portion Drift', icon: '⚖️' },
  { value: 'theft', label: 'Theft', icon: '🔒' },
  { value: 'unaccounted', label: 'Unaccounted', icon: '❓' },
];

@Component({
  selector: 'app-variance-engine',
  imports: [InventoryLayout, DatePipe],
  templateUrl: './variance-engine.html',
})
export class VarianceEngine {
  private store = inject(InventoryStore);

  reasons = REASONS;
  ingredients = this.store.ingredients;

  // log form state
  selectedIngId = signal('');
  actualQty = signal('');
  reason = signal<Reason>('unaccounted');
  submitted = signal(false);

  selectedIng = computed(() => this.ingredients().find(i => i.id === this.selectedIngId()));
  theoreticalQty = computed(() => this.selectedIng()?.currentStock ?? 0);
  actualNum = computed(() => parseFloat(this.actualQty()) || 0);
  variance = computed(() => this.actualNum() - this.theoreticalQty());
  variancePct = computed(() => {
    const t = this.theoreticalQty();
    return t > 0 ? (Math.abs(this.variance()) / t) * 100 : 0;
  });
  flagged = computed(() => this.variancePct() > 5);
  impact = computed(() => Math.abs(this.variance()) * (this.selectedIng()?.unitCost ?? 0));

  // colors + message for the live result box
  result = computed(() => {
    if (!this.flagged()) {
      return { label: '✓ Within Tolerance (±5%)', color: '#4A7C59', bg: '#4A7C5912', border: '#4A7C5950' };
    }
    return this.variance() < 0
      ? { label: '🔴 Significant Shortage', color: '#C0392B', bg: '#C0392B12', border: '#C0392B50' }
      : { label: '⚠ Overage Detected', color: '#8B6914', bg: '#D4A84312', border: '#D4A84350' };
  });

  // audit log rows with the ingredient, reason and peso impact worked out
  records = computed(() =>
    this.store.varianceRecords().map(v => {
      const ing = this.ingredients().find(i => i.id === v.ingredientId);
      return {
        v,
        ing,
        reason: REASONS.find(r => r.value === v.reason),
        impact: ing ? Math.abs(v.variance) * ing.unitCost : null,
      };
    }),
  );

  flaggedCount = computed(() => this.store.varianceRecords().filter(v => v.flagged).length);
  totalValue = computed(() => this.records().reduce((s, r) => s + (r.impact ?? 0), 0));

  summary = computed(() => [
    { label: 'Total Variance Records', value: String(this.records().length), color: '#7A3B1E' },
    { label: 'Flagged (>5% drift)', value: String(this.flaggedCount()), color: '#C0392B' },
    { label: 'Est. Variance Value', value: `₱${this.totalValue().toFixed(0)}`, color: '#8B6914' },
  ]);

  onIngredient(e: Event) {
    this.selectedIngId.set((e.target as HTMLSelectElement).value);
    this.actualQty.set('');
  }

  onActual(e: Event) {
    this.actualQty.set((e.target as HTMLInputElement).value);
  }

  handleLog() {
    const ing = this.selectedIng();
    if (!ing || !this.actualQty()) return;

    this.store.logVariance({
      ingredientId: ing.id,
      date: new Date(),
      theoreticalQty: this.theoreticalQty(),
      actualQty: this.actualNum(),
      variance: this.variance(),
      reason: this.reason(),
      flagged: this.flagged(),
    });

    this.submitted.set(true);
    setTimeout(() => {
      this.submitted.set(false);
      this.actualQty.set('');
      this.selectedIngId.set('');
    }, 1800);
  }
}