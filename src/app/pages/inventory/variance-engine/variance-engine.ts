import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IngredientCategory,
  InventoryStore,
  VarianceReason,
} from '../../../store/inventory-store';

type Filter = 'All' | 'Flagged' | 'Good';

interface Bar {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  color: string;
  label: string;
  value: number;
}

@Component({
  selector: 'app-variance-engine',
  standalone: true,
  imports: [StaffLayout, FormsModule, DatePipe],
  templateUrl: './variance-engine.html',
  styleUrl: './variance-engine.css',
})
export class VarianceEngine {
  nav = INVENTORY_NAV;
  private inv = inject(InventoryStore);

  readonly ingredients = this.inv.ingredients;
  readonly tolerances = this.inv.tolerances;

  readonly CATEGORIES: IngredientCategory[] = [
    'Proteins', 'Produce', 'Dry Goods',
    'Condiments & Seasonings', 'Dairy & Eggs', 'Packaging',
  ];

  readonly REASONS: { value: VarianceReason; label: string }[] = [
    { value: 'spoilage', label: 'Spoilage' },
    { value: 'shrinkage', label: 'Shrinkage' },
    { value: 'portion_drift', label: 'Portion Drift' },
    { value: 'theft', label: 'Theft' },
    { value: 'damaged', label: 'Damaged Goods' },
    { value: 'unaccounted', label: 'Unaccounted' },
  ];

  readonly FILTERS: Filter[] = ['All', 'Flagged', 'Good'];
  readonly filter = signal<Filter>('All');

  /** All records, newest first. */
  readonly records = computed(() =>
    [...this.inv.varianceRecords()].sort((a, b) => b.date.getTime() - a.date.getTime())
  );
  readonly flaggedRecords = computed(() => this.records().filter((v) => v.flagged));

  readonly shown = computed(() => {
    switch (this.filter()) {
      case 'Flagged': return this.flaggedRecords();
      case 'Good': return this.records().filter((v) => !v.flagged);
      default: return this.records();
    }
  });

  /** Flagged records that still have no cause tagged. */
  readonly untagged = computed(() => this.flaggedRecords().filter((v) => !v.reason));
  readonly untaggedNames = computed(() =>
    [...new Set(this.untagged().map((v) => this.getIng(v.ingredientId)?.name ?? v.ingredientId))].join(' · ')
  );

  readonly flaggedValue = computed(() =>
    this.flaggedRecords().reduce((s, v) => s + this.impact(v.ingredientId, v.variance), 0)
  );

  readonly summary = computed(() => {
    const total = this.records().length;
    const flagged = this.flaggedRecords().length;
    return [
      { label: 'Delivery Count Checks', value: String(total), color: '#7A3B1E' },
      { label: 'Flagged (Discrepancy)', value: String(flagged), color: '#C0392B' },
      {
        label: 'Within Tolerance',
        value: total ? (((total - flagged) / total) * 100).toFixed(0) + '%' : '—',
        color: '#4A7C59',
      },
      { label: 'Flagged Variance Value', value: '₱' + this.flaggedValue().toFixed(0), color: '#8B6914' },
    ];
  });

  /** Trend chart: peso impact of the last 12 count checks, oldest to newest. */
  readonly chartBars = computed<Bar[]>(() => {
    const data = this.records().slice(0, 12).reverse();
    if (!data.length) return [];
    const impacts = data.map((v) => this.impact(v.ingredientId, v.variance));
    const max = Math.max(1, ...impacts);
    const slot = 580 / Math.max(data.length, 6);
    const w = slot * 0.6;
    return data.map((v, i) => {
      const h = Math.max(2, (impacts[i] / max) * 105);
      const x = 10 + i * slot + (slot - w) / 2;
      return {
        id: v.id,
        x,
        y: 135 - h,
        w,
        h,
        cx: x + w / 2,
        color: v.flagged ? '#C0392B' : '#4A7C59',
        label: `${v.date.getMonth() + 1}/${v.date.getDate()}`,
        value: Math.round(impacts[i]),
      };
    });
  });

  getIng(id: string) {
    return this.ingredients().find((i) => i.id === id);
  }

  impact(ingId: string, variance: number): number {
    return Math.abs(variance) * (this.getIng(ingId)?.unitCost ?? 0);
  }

  countFor(f: Filter): number {
    if (f === 'Flagged') return this.flaggedRecords().length;
    if (f === 'Good') return this.records().length - this.flaggedRecords().length;
    return this.records().length;
  }

  setTolerance(category: string, value: string | number | null) {
    this.inv.setTolerance(category, Number(value));
  }

  setReason(id: string, value: string) {
    this.inv.updateVarianceReason(id, (value || undefined) as VarianceReason | undefined);
  }

  /** Automated variance audit report (CSV). */
  exportCsv() {
    const head = [
      'Record', 'Date', 'PO', 'Ingredient', 'Category', 'UOM',
      'System (Theoretical)', 'Physical Count', 'Variance', 'Variance %',
      'Tolerance %', 'Status', 'Cause', 'Impact (PHP)',
    ];
    const rows = this.records().map((v) => {
      const ing = this.getIng(v.ingredientId);
      return [
        v.id,
        v.date.toISOString().slice(0, 10),
        v.poId ?? '',
        ing?.name ?? v.ingredientId,
        ing?.category ?? '',
        ing?.uom ?? '',
        v.theoreticalQty,
        v.actualQty,
        v.variance,
        v.variancePct.toFixed(1),
        v.tolerancePct,
        v.flagged ? 'Flagged (Discrepancy)' : 'Good',
        this.REASONS.find((r) => r.value === v.reason)?.label ?? '',
        this.impact(v.ingredientId, v.variance).toFixed(2),
      ];
    });
    const csv = [head, ...rows]
      .map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variance-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}