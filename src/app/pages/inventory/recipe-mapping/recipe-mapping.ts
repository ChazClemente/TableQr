import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { INVENTORY_NAV, StaffLayout } from '../../../components/admin-layout/admin-layout';
import { MenuStore } from '../../../store/menu-store';
import { InventoryStore, type RecipeIngredient } from '../../../store/inventory-store';

@Component({
  selector: 'app-recipe-mapping',
  imports: [StaffLayout, FormsModule],
  templateUrl: './recipe-mapping.html',
})
export class RecipeMapping {
  private inventory = inject(InventoryStore);
  private menu = inject(MenuStore);

  nav = INVENTORY_NAV;

  selectedMenuId: string = '';
  editLines: RecipeIngredient[] | null = null;
  editing = false;

  get menuItems() { return this.menu.items(); }
  get ingredients() { return this.inventory.ingredients(); }
  get recipeMappings() { return this.inventory.recipeMappings(); }
  get selectedItem() { return this.menuItems.find(m => m.id === this.currentMenuId); }
  get existingMapping() { return this.recipeMappings.find(r => r.menuItemId === this.currentMenuId); }
  get lines() { return this.editLines ?? this.existingMapping?.ingredients ?? []; }
  get displayLines() { return this.editing ? this.editLines ?? [] : this.lines; }

  // Kapag wala pang napipili, gamitin ang unang menu item (naglo-load pa ang menu mula Supabase)
  get currentMenuId() { return this.selectedMenuId || this.menuItems[0]?.id || ''; }

  hasMapped(id: string) { return this.recipeMappings.some(r => r.menuItemId === id); }
  ingredient(id: string) { return this.ingredients.find(i => i.id === id); }

  // Cost preview
  get costPerServing() {
    return this.lines.reduce((sum, l) => {
      const ing = this.ingredient(l.ingredientId);
      return ing ? sum + ing.unitCost * l.qtyPerServing : sum;
    }, 0);
  }

  selectItem(id: string) {
    this.selectedMenuId = id;
    this.editing = false;
    this.editLines = null;
  }

  startEdit() {
    // Copy each line so edits don't touch the saved mapping until Save
    this.editLines = (this.existingMapping?.ingredients ?? []).map(l => ({ ...l }));
    this.editing = true;
  }

  addLine() {
    this.editLines = [...(this.editLines ?? []), { ingredientId: this.ingredients[0]?.id ?? '', qtyPerServing: 0 }];
  }

  removeLine(idx: number) {
    this.editLines = (this.editLines ?? []).filter((_, i) => i !== idx);
  }

  handleSave() {
    const item = this.selectedItem;
    if (!item || this.editLines === null) return;
    this.inventory.saveRecipeMapping({
      menuItemId: this.currentMenuId,
      menuItemName: item.name,
      ingredients: this.editLines
        .map(l => ({ ...l, qtyPerServing: +l.qtyPerServing }))
        .filter(l => l.ingredientId && l.qtyPerServing > 0),
    });
    this.editing = false;
    this.editLines = null;
  }

  cancel() {
    this.editing = false;
    this.editLines = null;
  }
}
