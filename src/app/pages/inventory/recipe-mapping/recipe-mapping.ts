import { Component, computed, inject, signal } from '@angular/core';
import { InventoryLayout } from '../../../components/inventory-layout/inventory-layout';
import { InventoryStore, type RecipeIngredient } from '../../../store/inventory-store';
import { MenuStore } from '../../../store/menu-store';

@Component({
  selector: 'app-recipe-mapping',
  imports: [InventoryLayout],
  templateUrl: './recipe-mapping.html',
})
export class RecipeMapping {
  private store = inject(InventoryStore);
  private menu = inject(MenuStore);

  ingredients = this.store.ingredients;
  menuItems = this.menu.items;
  menuLoading = this.menu.loading;

  selectedMenuId = signal<string | null>(null);
  editLines = signal<RecipeIngredient[] | null>(null);
  editing = signal(false);

  // the menu loads async, so default to the first item once it arrives
  selectedId = computed(() => this.selectedMenuId() ?? this.menuItems()[0]?.id ?? '');
  selectedItem = computed(() => this.menuItems().find(m => m.id === this.selectedId()));
  existingMapping = computed(() => this.store.recipeMappings().find(r => r.menuItemId === this.selectedId()));
  mappedIds = computed(() => new Set(this.store.recipeMappings().map(r => r.menuItemId)));

  // while editing this is the draft, otherwise the saved recipe
  lines = computed(() => this.editLines() ?? this.existingMapping()?.ingredients ?? []);

  rows = computed(() =>
    this.lines().map((line, idx) => ({
      line,
      idx,
      ing: this.ingredients().find(i => i.id === line.ingredientId),
    })),
  );

  // cost preview
  costPerServing = computed(() =>
    this.lines().reduce((sum, l) => {
      const ing = this.ingredients().find(i => i.id === l.ingredientId);
      return ing ? sum + ing.unitCost * l.qtyPerServing : sum;
    }, 0),
  );

  foodCostPct = computed(() => {
    const price = this.selectedItem()?.price ?? 0;
    return price > 0 ? (this.costPerServing() / price) * 100 : 0;
  });

  selectItem(id: string) {
    this.selectedMenuId.set(id);
    this.editing.set(false);
    this.editLines.set(null);
  }

  startEdit() {
    const current = this.existingMapping()?.ingredients;
    this.editLines.set(current ? [...current] : []);
    this.editing.set(true);
  }

  addLine() {
    this.editLines.update(prev => [...(prev ?? []), { ingredientId: this.ingredients()[0]?.id ?? '', qtyPerServing: 0 }]);
  }

  removeLine(idx: number) {
    this.editLines.update(prev => (prev ?? []).filter((_, i) => i !== idx));
  }

  onIngredient(idx: number, e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    this.editLines.update(prev => (prev ?? []).map((l, i) => (i === idx ? { ...l, ingredientId: id } : l)));
  }

  onQty(idx: number, e: Event) {
    const qty = +(e.target as HTMLInputElement).value;
    this.editLines.update(prev => (prev ?? []).map((l, i) => (i === idx ? { ...l, qtyPerServing: qty } : l)));
  }

  handleSave() {
    const item = this.selectedItem();
    const draft = this.editLines();
    if (!item || draft === null) return;

    this.store.saveRecipeMapping({
      menuItemId: item.id,
      menuItemName: item.name,
      ingredients: draft.filter(l => l.ingredientId && l.qtyPerServing > 0),
    });
    this.cancel();
  }

  cancel() {
    this.editing.set(false);
    this.editLines.set(null);
  }
}