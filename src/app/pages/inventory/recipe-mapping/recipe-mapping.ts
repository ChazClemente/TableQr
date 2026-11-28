import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);

  nav = INVENTORY_NAV;
  selectedMenuId: string = '';

  // NEW: Search and Filter state
  search = '';
  filterCat = 'All';
  categories = ['Soup', 'Dry Dishes', 'Pulutan', 'Sizzling', 'Noodles', 'Pancit sa Bilao', 'Sandwiches', 'Beverages', 'Rice', 'Native Dishes', 'Dishes', 'Toppings', 'Specialties', 'Fish', 'Desserts', 'Ulam'];

  constructor() {
    const requestedMenuId = this.route.snapshot.queryParamMap.get('menuItemId');
    if (requestedMenuId && this.menu.items().some(item => item.id === requestedMenuId)) {
      this.selectedMenuId = requestedMenuId;
    }
  }

  editLines: RecipeIngredient[] | null = null;
  editing = false;

  // NEW: Apply search and category filter
  get menuItems() {
    return this.menu.items().filter(item => {
      const matchSearch = !this.search || 
        item.name.toLowerCase().includes(this.search.toLowerCase()) || 
        String(item.id).includes(this.search);
      
      const matchCat = this.filterCat === 'All' || item.category === this.filterCat;
      
      return matchSearch && matchCat;
    });
  }

  get ingredients() { return this.inventory.ingredients(); }
  get recipeMappings() { return this.inventory.recipeMappings(); }
  
  get selectedItem() { return this.menu.items().find(m => m.id === this.currentMenuId); }
  get existingMapping() { return this.recipeMappings.find(r => r.menuItemId === this.currentMenuId); }
  get lines() { return this.editLines ?? this.existingMapping?.ingredients ?? []; }
  get displayLines() { return this.editing ? this.editLines ?? [] : this.lines; }

  get currentMenuId() { return this.selectedMenuId || this.menuItems[0]?.id || ''; }

  hasMapped(id: string) { return this.recipeMappings.some(r => r.menuItemId === String(id)); }
  ingredient(id: string) { return this.ingredients.find(i => i.id === id); }

  get costPerServing() {
    return this.lines.reduce((sum, l) => {
      const ing = this.ingredient(l.ingredientId);
      return ing ? sum + ing.unitCost * l.qtyPerServing : sum;
    }, 0);
  }

  get foodCostPct() {
    const price = this.selectedItem?.price || 0;
    if (price <= 0) return 0;
    return (this.costPerServing / price) * 100;
  }

  selectItem(id: string) {
    this.selectedMenuId = id;
    this.editing = false;
    this.editLines = null;
  }

  startEdit() {
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
    const item = this.menu.items().find(m => m.id === this.currentMenuId);
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