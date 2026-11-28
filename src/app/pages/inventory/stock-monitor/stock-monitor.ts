import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  InventoryStore,
  Ingredient,
  IngredientCategory,
  StockStatus,
} from '../../../store/inventory-store';

interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  bar: string;
  label: string;
}

interface DraftLine {
  ingredientId: string;
  supplierId: string;
  qty: number;
  include: boolean;
}

interface DraftLineView extends DraftLine {
  ing: Ingredient;
  status: StockStatus;
  need: number;
  subtotal: number;
}

interface DraftGroup {
  supplierId: string;
  supplierName: string;
  lines: DraftLineView[];
  count: number;
  total: number;
}

interface CreatedPO {
  id: string;
  supplier: string;
  lines: number;
  total: number;
}

@Component({
  selector: 'app-stock-monitor',
  standalone: true,
  imports: [StaffLayout, FormsModule, RouterLink],
  templateUrl: './stock-monitor.html',
})
export class StockMonitor {
  nav = INVENTORY_NAV;
  private inv = inject(InventoryStore);

  readonly ingredients = this.inv.ingredients;
  readonly suppliers = this.inv.suppliers; 

  readonly FILTERS: (StockStatus | 'All')[] = ['All', 'Good', 'Low', 'Critical'];

  readonly CATEGORIES: IngredientCategory[] = [
    'Proteins', 'Produce', 'Dry Goods',
    'Condiments & Seasonings', 'Dairy & Eggs', 'Packaging',
  ];

  readonly CAT_EMOJI: Record<IngredientCategory, string> = {
    'Proteins': '🥩', 'Produce': '🥬', 'Dry Goods': '🌾',
    'Condiments & Seasonings': '🧂', 'Dairy & Eggs': '🥚', 'Packaging': '📦',
  };

  readonly STATUS_STYLE: Record<StockStatus, StatusStyle> = {
    Good:     { bg: '#4A7C5918', text: '#4A7C59', border: '#4A7C5940', bar: '#4A7C59', label: '✓ Good' },
    Low:      { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350', bar: '#D4A843', label: '⚠ Low' },
    Critical: { bg: '#C0392B18', text: '#C0392B', border: '#C0392B40', bar: '#C0392B', label: '🔴 Critical' },
  };

  readonly search = signal('');
  readonly filterStatus = signal<StockStatus | 'All'>('All');
  readonly filterCat = signal('All');
  readonly filterSupplier = signal('All');

  readonly baseFiltered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.filterCat();
    const sup = this.filterSupplier();
    return this.ingredients().filter(
      (i) =>
        (cat === 'All' || i.category === cat) &&
        (sup === 'All' || i.supplierId === sup) &&
        (!q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    );
  });

  readonly visible = computed(() =>
    this.baseFiltered().filter(
      (i) => this.filterStatus() === 'All' || this.status(i) === this.filterStatus()
    )
  );

  readonly filtersActive = computed(
    () =>
      this.search().trim() !== '' ||
      this.filterCat() !== 'All' ||
      this.filterSupplier() !== 'All' ||
      this.filterStatus() !== 'All'
  );

  countFor(f: StockStatus | 'All'): number {
    const list = this.baseFiltered();
    return f === 'All' ? list.length : list.filter((i) => this.status(i) === f).length;
  }

  clearFilters() {
    this.search.set('');
    this.filterCat.set('All');
    this.filterSupplier.set('All');
    this.filterStatus.set('All');
  }

  readonly criticals = computed(() => this.ingredients().filter((i) => this.status(i) === 'Critical'));
  readonly lows = computed(() => this.ingredients().filter((i) => this.status(i) === 'Low'));

  names(list: Ingredient[]): string {
    return list.map((i) => i.name).join(' · ');
  }

  readonly openPOByIngredient = computed(() => {
    const map = new Map<string, string>();
    for (const po of this.inv.purchaseOrders()) {
      if (po.status === 'Received') continue;
      for (const l of po.lineItems) {
        if (l.receivedQty < l.orderedQty && !map.has(l.ingredientId)) {
          map.set(l.ingredientId, po.id);
        }
      }
    }
    return map;
  });

  readonly suggestions = computed(() =>
    this.ingredients()
      .filter((i) => this.status(i) !== 'Good' && !this.openPOByIngredient().has(i.id))
      .sort((a, b) => {
        const rank = (i: Ingredient) => (this.status(i) === 'Critical' ? 0 : 1);
        return rank(a) - rank(b) || this.pctOfReorder(a) - this.pctOfReorder(b);
      })
  );

  readonly suggestionCritical = computed(
    () => this.suggestions().filter((i) => this.status(i) === 'Critical').length
  );

  readonly alreadyOrdered = computed(
    () =>
      this.ingredients().filter(
        (i) => this.status(i) !== 'Good' && this.openPOByIngredient().has(i.id)
      ).length
  );

  onOrder(id: string): string | undefined {
    return this.openPOByIngredient().get(id);
  }

  suggestedQty(i: Ingredient): number {
    return Math.max(i.reorderQty, Math.ceil(this.need(i) * 10) / 10);
  }

  readonly reviewOpen = signal(false);
  readonly draft = signal<DraftLine[]>([]);
  readonly dates = signal<Record<string, string>>({});
  readonly reviewError = signal('');
  readonly created = signal<CreatedPO[] | null>(null);
  readonly minDate = this.isoDate(0);

  readonly groups = computed<DraftGroup[]>(() => {
    const by = new Map<string, DraftLineView[]>();
    for (const l of this.draft()) {
      const ing = this.getIng(l.ingredientId);
      if (!ing) continue;
      const view: DraftLineView = {
        ...l,
        ing,
        status: this.status(ing),
        need: this.need(ing),
        subtotal: l.include ? l.qty * ing.unitCost : 0,
      };
      by.set(l.supplierId, [...(by.get(l.supplierId) ?? []), view]);
    }
    return [...by].map(([supplierId, lines]) => ({
      supplierId,
      supplierName: this.supplierFullName(supplierId),
      lines,
      count: lines.filter((l) => l.include && l.qty > 0).length,
      total: lines.reduce((s, l) => s + l.subtotal, 0),
    }));
  });

  readonly selectedCount = computed(() => this.groups().reduce((s, g) => s + g.count, 0));
  readonly selectedGroups = computed(() => this.groups().filter((g) => g.count > 0).length);
  readonly grandTotal = computed(() => this.groups().reduce((s, g) => s + g.total, 0));

  openReview() {
    const lines = this.suggestions().map<DraftLine>((i) => ({
      ingredientId: i.id,
      supplierId: i.supplierId,
      qty: this.suggestedQty(i),
      include: true,
    }));
    const dates: Record<string, string> = {};
    for (const l of lines) dates[l.supplierId] = this.isoDate(2);

    this.draft.set(lines);
    this.dates.set(dates);
    this.reviewError.set('');
    this.created.set(null);
    this.reviewOpen.set(true);
  }

  closeReview() {
    this.reviewOpen.set(false);
    this.created.set(null);
  }

  setInclude(ingId: string, value: boolean) {
    this.draft.update((d) => d.map((l) => (l.ingredientId === ingId ? { ...l, include: !!value } : l)));
  }

  setQty(ingId: string, value: string | number | null) {
    const n = Math.max(0, Number(value) || 0);
    this.draft.update((d) => d.map((l) => (l.ingredientId === ingId ? { ...l, qty: n } : l)));
  }

  setDate(supplierId: string, value: string) {
    this.dates.update((d) => ({ ...d, [supplierId]: value }));
  }

  confirmOrders() {
    const chosen = this.groups().filter((g) => g.count > 0);
    if (!chosen.length) {
      this.reviewError.set('Select at least one ingredient with a quantity above zero.');
      return;
    }
    for (const g of chosen) {
      if (!this.dates()[g.supplierId]) {
        this.reviewError.set(`Choose an expected delivery date for ${g.supplierName}.`);
        return;
      }
    }
    this.reviewError.set('');

    const result: CreatedPO[] = [];
    for (const g of chosen) {
      const lines = g.lines
        .filter((l) => l.include && l.qty > 0)
        .map((l) => ({
          ingredientId: l.ingredientId,
          orderedQty: l.qty,
          receivedQty: 0,
          unitCost: l.ing.unitCost,
        }));
      const po = this.inv.createPO(
        g.supplierId,
        lines,
        new Date(this.dates()[g.supplierId]),
        'Reorder suggested by Stock Monitor and confirmed by staff'
      );
      result.push({ id: po.id, supplier: g.supplierName, lines: lines.length, total: po.total });
    }
    this.created.set(result);
  }

  getIng(id: string) {
    return this.ingredients().find((i) => i.id === id);
  }

  status(ing: Ingredient): StockStatus {
    return this.inv.stockStatus(ing);
  }

  style(s: StockStatus): StatusStyle {
    return this.STATUS_STYLE[s];
  }

  supplierName(id: string): string {
    return this.suppliers().find((s) => s.id === id)?.name.split(' ')[0] ?? '—';
  }

  supplierFullName(id: string): string {
    return this.suppliers().find((s) => s.id === id)?.name ?? id;
  }

  // ─── Progress Bar Math ───
  private scale(ing: Ingredient): number {
    // The bar always scales to 2x the reorder point. 
    // This ensures the markers and the bar never break.
    return ing.reorderPoint * 2 || 1;
  }

  barPct(ing: Ingredient): number {
    return Math.min(100, (ing.currentStock / this.scale(ing)) * 100);
  }

  safetyPct(ing: Ingredient): number {
    return (ing.safetyStock / this.scale(ing)) * 100;
  }

  reorderPct(ing: Ingredient): number {
    return (ing.reorderPoint / this.scale(ing)) * 100;
  }

  pctOfReorder(ing: Ingredient): number {
    return (ing.currentStock / (ing.reorderPoint || 1)) * 100;
  }

  need(ing: Ingredient): number {
    return Math.max(0, ing.reorderPoint - ing.currentStock);
  }

  stockStatusText(ing: Ingredient): string {
    const st = this.status(ing);
    if (st === 'Critical') {
      const short = Math.max(0, ing.safetyStock - ing.currentStock);
      return `Critically low (−${short.toFixed(1)} ${ing.uom} to safety)`;
    }
    if (st === 'Low') {
      const short = Math.max(0, ing.reorderPoint - ing.currentStock);
      return `Running low (−${short.toFixed(1)} ${ing.uom} to alert)`;
    }
    const above = ing.currentStock - ing.reorderPoint;
    return `Healthy (+${above.toFixed(1)} ${ing.uom} above alert)`;
  }

  private isoDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
}