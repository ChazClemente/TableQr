import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { NumPipe } from '../../../shared/num.pipe';
import {
  InventoryStore, stockStatus, suppliers,
  type Ingredient, type IngredientCategory, type StockStatus, type UOM,
} from '../../../store/inventory-store';

const CATEGORIES: IngredientCategory[] = ['Proteins', 'Produce', 'Dry Goods', 'Condiments & Seasonings', 'Dairy & Eggs', 'Packaging'];
const UOMS: UOM[] = ['kg', 'g', 'L', 'mL', 'pcs', 'pack', 'tray', 'bundle'];
const CAT_EMOJI: Record<IngredientCategory, string> = {
  'Proteins': '🥩', 'Produce': '🥬', 'Dry Goods': '🌾',
  'Condiments & Seasonings': '🧂', 'Dairy & Eggs': '🥚', 'Packaging': '📦',
};

const BLANK: Omit<Ingredient, 'id'> = {
  name: '', category: 'Produce', uom: 'kg', unitCost: 0,
  supplierId: suppliers[0].id, currentStock: 0, safetyStock: 0, reorderPoint: 0, reorderQty: 0,
};

const STATUS_COLOR: Record<StockStatus, { bg: string; text: string; border: string }> = {
  Good:     { bg: '#4A7C5918', text: '#4A7C59', border: '#4A7C5940' },
  Low:      { bg: '#D4A84320', text: '#8B6914', border: '#D4A84350' },
  Critical: { bg: '#C0392B18', text: '#C0392B', border: '#C0392B40' },
};

@Component({
  selector: 'app-ingredient-master',
  imports: [StaffLayout, FormsModule, NumPipe],
  templateUrl: './ingredient-master.html',
})
export class IngredientMaster {
  private inventory = inject(InventoryStore);
  nav = INVENTORY_NAV;
  categories = CATEGORIES;
  uoms = UOMS;
  catEmoji = CAT_EMOJI;
  suppliers = suppliers;
  statusColor = STATUS_COLOR;
  statuses: StockStatus[] = ['Good', 'Low', 'Critical'];
  stockStatus = stockStatus;

  filterCat: IngredientCategory | 'All' = 'All';
  search = '';
  editId: string | null = null;
  form: Omit<Ingredient, 'id'> = { ...BLANK };
  showForm = false;

  get ingredients() { return this.inventory.ingredients(); }

  get visible() {
    return this.ingredients.filter(i => {
      const matchCat = this.filterCat === 'All' || i.category === this.filterCat;
      const matchSearch = !this.search || i.name.toLowerCase().includes(this.search.toLowerCase());
      return matchCat && matchSearch;
    });
  }

  count(s: StockStatus) { return this.ingredients.filter(i => stockStatus(i) === s).length; }
  supplierShort(id: string) { return suppliers.find(s => s.id === id)?.name.split(' ')[0]; }

  openNew() {
    this.editId = null;
    this.form = { ...BLANK };
    this.showForm = true;
  }

  openEdit(ing: Ingredient) {
    this.editId = ing.id;
    const { id: _id, ...rest } = ing;
    this.form = { ...rest };
    this.showForm = true;
  }

 handleSave() {
  const id = this.editId ?? `ING-${String(this.ingredients.length + 1).padStart(2, '0')}`;
  this.inventory.saveIngredient({ id, ...this.form });
  this.showForm = false;
}
closeOnBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) this.showForm = false;
}
}