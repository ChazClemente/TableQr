import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IngredientCategory,
  InventoryStore,
  VarianceReason,
} from '../../../store/inventory-store';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Filter = 'All' | 'Flagged' | 'Good';

@Component({
  selector: 'app-variance-engine',
  standalone: true,
  imports: [StaffLayout, FormsModule, DatePipe],
  templateUrl: './variance-engine.html',
})
export class VarianceEngine {
  nav = INVENTORY_NAV;
  private inv = inject(InventoryStore);

  readonly ingredients = this.inv.ingredients;
  readonly tolerances = this.inv.tolerances;
  readonly printDate = new Date();

  readonly CATEGORIES: IngredientCategory[] = [
    'Proteins', 'Produce', 'Dry Goods',
    'Condiments & Seasonings', 'Dairy & Eggs', 'Packaging',
  ];

  readonly REASONS: { value: VarianceReason; label: string }[] = [
    { value: 'spoilage', label: 'Spoilage / Expired' },
    { value: 'shrinkage', label: 'Shrinkage / Evaporation' },
    { value: 'portion_drift', label: 'Over-portioning' },
    { value: 'theft', label: 'Theft' },
    { value: 'damaged', label: 'Damaged in transit' },
    { value: 'unaccounted', label: 'Unaccounted / Unknown' },
  ];

  readonly FILTERS: Filter[] = ['All', 'Flagged', 'Good'];
  readonly filter = signal<Filter>('All');

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

  readonly untagged = computed(() => this.flaggedRecords().filter((v) => !v.reason));
  readonly untaggedNames = computed(() =>
    [...new Set(this.untagged().map((v) => this.getIng(v.ingredientId)?.name ?? v.ingredientId))].join(', ')
  );

  readonly flaggedValue = computed(() =>
    this.flaggedRecords().reduce((s, v) => s + this.impact(v.ingredientId, v.variance), 0)
  );

  readonly summary = computed(() => {
    const total = this.records().length;
    const flagged = this.flaggedRecords().length;
    return [
      { label: 'Total Audits', value: String(total), color: '#7A3B1E' },
      { label: 'Flagged Shortages', value: String(flagged), color: '#C0392B' },
      {
        label: 'Accuracy Rate',
        value: total ? (((total - flagged) / total) * 100).toFixed(0) + '%' : '—',
        color: '#4A7C59',
      },
      { label: 'Total Loss Value', value: '₱' + this.flaggedValue().toFixed(0), color: '#8B6914' },
    ];
  });

  getIng(id: string) {
    return this.ingredients().find((i) => i.id === id);
  }

  impact(ingId: string, variance: number): number {
    return Math.abs(variance) * (this.getIng(ingId)?.unitCost ?? 0);
  }

  getReasonLabel(reason?: string): string {
    if (!reason) return '—';
    return this.REASONS.find(r => r.value === reason)?.label || '—';
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

  exportPdf() {
  const doc = new jsPDF({ orientation: 'landscape' });
  const rows = this.shown(); // respects the current filter (All / Flagged / Good)
  const now = new Date();

  doc.setFontSize(16);
  doc.text('Inventory Audit Report', 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${now.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}`, 14, 22);

  const s = this.summary();
  doc.text(s.map(x => `${x.label}: ${x.value}`).join('   |   '), 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [['Date', 'Ingredient', 'PO', 'System', 'Actual', 'Difference', 'Impact', 'Status', 'Cause']],
    body: rows.map(v => {
      const ing = this.getIng(v.ingredientId);
      const uom = ing?.uom ?? '';
      return [
        v.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        ing?.name ?? v.ingredientId,
        v.poId ?? 'No PO',
        `${v.theoreticalQty} ${uom}`,
        `${v.actualQty} ${uom}`,
        `${v.variance >= 0 ? '+' : ''}${v.variance} ${uom}`,
        `PHP ${this.impact(v.ingredientId, v.variance).toFixed(0)}`,
        v.flagged ? 'Flagged' : 'Good',
        v.flagged ? this.getReasonLabel(v.reason) : '-',
      ];
    }),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [122, 59, 30] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7 && data.cell.raw === 'Flagged') {
        data.cell.styles.textColor = [192, 57, 43];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(`inventory-audit-${now.toISOString().slice(0, 10)}.pdf`);
}
}