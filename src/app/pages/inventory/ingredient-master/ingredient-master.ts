import { Component, computed, inject, signal } from '@angular/core';
import { InventoryLayout } from '../../../components/inventory-layout/inventory-layout';
import {
  InventoryStore,
  type Ingredient,
  type IngredientCategory,
  type StockStatus,
  type UOM,
} from '../../../store/inventory-store';

type IngredientForm = Omit<Ingredient, 'id'>;
type NumberKey = 'unitCost' | 'currentStock' | 'safetyStock' | 'reorderPoint' | 'reorderQty';
type SelectKey = 'category' | 'uom' | 'supplierId';

@Component({
  selector: 'app-ingredient-master',
  imports: [InventoryLayout],
  templateUrl: './ingredient-master.html',
})
export class IngredientMaster {
  private store = inject(InventoryStore);

  categories: IngredientCategory[] = ['Proteins', 'Produce', 'Dry Goods', 'Condiments & Seasonings', 'Dairy & Eggs', 'Packaging'];
  uoms: UOM[] = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'tray', 'bundle'];
  statuses: StockStatus[] = ['Good', 'Low', 'Critical'];

  catEmoji: Record<IngredientCategory, string> = {
    'Proteins': '🥩', 'Produce': '🥬', 'Dry Goods': '🌾',
    'Condiments & Seasonings': '🧂', 'Dairy & Eggs': '🥚', 'Packaging': '📦',
  };

  statusColor: Record<StockStatus, { bg: string; text: string; border: string }> = {
    Good: { bg: '#4A7C5918', text: '#4A7C59', border: '#4A7C5940' },
    Low: { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350' },
    Critical: { bg: '#C0392B18', text: '#C0392B', border: '#C0392B40' },
  };

  // fields shown in the slide-over form
  numberFields: { label: string; key: NumberKey; hint?: string }[] = [
    { label: 'Unit Cost (₱)', key: 'unitCost' },
    { label: 'Current Stock', key: 'currentStock' },
    { label: 'Safety Stock', key: 'safetyStock', hint: 'Below this = Critical' },
    { label: 'Reorder Point', key: 'reorderPoint', hint: 'Below this = Low' },
    { label: 'Reorder Qty', key: 'reorderQty', hint: 'Suggested amount per purchase order' },
  ];

  selectFields: { label: string; key: 'category' | 'uom'; options: string[] }[] = [
    { label: 'Category', key: 'category', options: this.categories },
    { label: 'Unit of Measure', key: 'uom', options: this.uoms },
  ];

  ingredients = this.store.ingredients;
  suppliers = this.store.suppliers;
  private stockStatus = this.store.stockStatus;

  filterCat = signal<IngredientCategory | 'All'>('All');
  search = signal('');
  editId = signal<string | null>(null);
  form = signal<IngredientForm>(this.blank());
  showForm = signal(false);

  // table rows with status + supplier name already worked out
  rows = computed(() => {
    const cat = this.filterCat();
    const q = this.search().toLowerCase();
    return this.ingredients()
      .filter(i => (cat === 'All' || i.category === cat) && (!q || i.name.toLowerCase().includes(q)))
      .map(ing => ({
        ing,
        status: this.stockStatus(ing),
        supplierName: this.suppliers().find(s => s.id === ing.supplierId)?.name.split(' ')[0] ?? '—',
      }));
  });

  // the Good / Low / Critical cards
  counts = computed(() =>
    this.statuses.map(status => ({
      status,
      count: this.ingredients().filter(i => this.stockStatus(i) === status).length,
    })),
  );

  private blank(): IngredientForm {
    return {
      name: '', category: 'Produce', uom: 'kg', unitCost: 0,
      supplierId: this.store.suppliers()[0]?.id ?? '',
      currentStock: 0, safetyStock: 0, reorderPoint: 0, reorderQty: 0,
    };
  }

  private patch(partial: Partial<IngredientForm>) {
    this.form.update(f => ({ ...f, ...partial }));
  }

  // ─── input handlers ──────────────────────────────────────────────────────────
  onSearch(e: Event) {
    this.search.set((e.target as HTMLInputElement).value);
  }

  onFilterCat(e: Event) {
    this.filterCat.set((e.target as HTMLSelectElement).value as IngredientCategory | 'All');
  }

  onName(e: Event) {
    this.patch({ name: (e.target as HTMLInputElement).value });
  }

  onNumber(key: NumberKey, e: Event) {
    this.patch({ [key]: +(e.target as HTMLInputElement).value } as Partial<IngredientForm>);
  }

  onSelect(key: SelectKey, e: Event) {
    this.patch({ [key]: (e.target as HTMLSelectElement).value } as Partial<IngredientForm>);
  }

  // ─── form actions ────────────────────────────────────────────────────────────
  openNew() {
    this.editId.set(null);
    this.form.set(this.blank());
    this.showForm.set(true);
  }

  openEdit(ing: Ingredient) {
    this.editId.set(ing.id);
    const { id, ...rest } = ing;
    this.form.set(rest);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
  }

  onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.closeForm();
  }

  handleSave() {
    const f = this.form();
    if (!f.name.trim()) return;
    const id = this.editId() ?? `ING-${String(this.ingredients().length + 1).padStart(2, '0')}`;
    this.store.saveIngredient({ id, ...f, name: f.name.trim() });
    this.closeForm();
  }
}