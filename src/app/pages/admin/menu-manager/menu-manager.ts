import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { Category } from '../../../data/menu';
import { MenuStore, type ManagedMenuItem } from '../../../store/menu-store';
import { InventoryStore } from '../../../store/inventory-store';
import { addAuditEvent } from '../../../store/user-store';

const CAT_COLORS = ['#7A3B1E', '#4A7C59', '#8B6914', '#5C2E0A', '#C0392B', '#2C6080'];

const BLANK: ManagedMenuItem = {
  id: '', name: '', description: '', price: 0, category: 'Ulam',
  available: true, popular: false, image: '', modifiers: [], tags: [],
};

@Component({
  selector: 'app-menu-manager',
  imports: [FormsModule],
  templateUrl: './menu-manager.html',
})
export class MenuManager {
  private menu = inject(MenuStore);
  private inventory = inject(InventoryStore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  get recipeMappings() { return this.inventory.recipeMappings(); }
  get ingredients() { return this.inventory.ingredients(); }

  recipeFor(menuItemId: string) {
    return this.recipeMappings.find(recipe => recipe.menuItemId === menuItemId);
  }

  manageRecipe(menuItemId: string) {
    this.router.navigate(['/inventory/recipes'], { queryParams: { menuItemId } });
  }

  recipeStockStatus(menuItemId: string): 'unmapped' | 'good' | 'low' | 'critical' {
    const recipe = this.recipeFor(menuItemId);
    if (!recipe || recipe.ingredients.length === 0) return 'unmapped';
    const mappedIngredients = recipe.ingredients
      .map(line => this.ingredients.find(ingredient => ingredient.id === line.ingredientId))
      .filter((ingredient): ingredient is NonNullable<typeof ingredient> => !!ingredient);
    if (mappedIngredients.length !== recipe.ingredients.length) return 'unmapped';
    const statuses = mappedIngredients.map(ingredient => this.inventory.stockStatus(ingredient));
    if (statuses.includes('Critical')) return 'critical';
    if (statuses.includes('Low')) return 'low';
    return 'good';
  }
  get categories() { return this.menu.categories(); }
  catColor(c: string) {
    const i = this.categories.indexOf(c as Category);
    return CAT_COLORS[(i < 0 ? 0 : i) % CAT_COLORS.length];
  }

  filterCat: Category | 'All' = 'All';
  search = '';
  form: ManagedMenuItem = structuredClone(BLANK);
  showForm = false;
  isNew = false;
  setupNewRecipe = false;
  confirmDelete: string | null = null;
  imageUrlError = '';
  nameError = '';
  recipeDraft: { ingredientId: string; qtyPerServing: number }[] = [];

  get setupChecklist() {
    return this.items
      .filter(item => !this.recipeFor(item.id)?.ingredients.length)
      .map(item => ({
        id: item.id,
        name: item.name,
        recipeComplete: false,
        available: item.available,
      }));
  }

  get incompleteSetupCount() {
    return this.setupChecklist.filter(item => !item.recipeComplete).length;
  }

  async toggleAvailable(id: string) {
    const item = this.items.find(menuItem => menuItem.id === id);
    if (!item) return;
    const status = this.recipeStockStatus(id);
    if (!item.available && (status === 'critical' || status === 'unmapped')) {
      const message = status === 'unmapped'
        ? 'This item has no recipe mapped. Make it available anyway?'
        : 'A recipe ingredient is at critical stock. Make this item available anyway?';
      if (!confirm(message)) return;
    }
    try {
      await this.menu.setAvailable(id, !item.available);
    } catch {
      alert('Could not update menu availability.');
    }
  }

 get items(): ManagedMenuItem[] {
    return this.menu.items().map(i => ({ ...i, modifiers: [], tags: [] }));
  }

  get visible() {
    return this.items.filter(i => {
      const matchCat = this.filterCat === 'All' || i.category === this.filterCat;
      const matchSearch = !this.search || i.name.toLowerCase().includes(this.search.toLowerCase());
      return matchCat && matchSearch;
    });
  }

  count(c: Category) { return this.items.filter(i => i.category === c).length; }

  openNew() {
    this.form = { ...structuredClone(BLANK), id: `m${this.items.length + 1}` };
    this.isNew = true;
    this.imageUrlError = '';
    this.nameError = '';
    this.setupNewRecipe = false;
    this.recipeDraft = [];
    this.showForm = true;
  }

  openEdit(item: ManagedMenuItem) {
    this.form = structuredClone(item);
    this.imageUrlError = '';
    this.nameError = '';
    this.isNew = false;
    this.showForm = true;
  }

    async handleSave() {
    const form = this.form;
    if (this.isNew && !form.image.trim()) {
      this.imageUrlError = 'Please enter an image URL for the new menu item.';
      return;
    }
    this.imageUrlError = '';
    this.nameError = '';
    const normalizedName = form.name.trim().toLocaleLowerCase();
    const duplicate = this.items.find(item =>
      item.id !== form.id && item.name.trim().toLocaleLowerCase() === normalizedName,
    );
    if (duplicate) {
      this.nameError = `A menu item named “${duplicate.name}” already exists.`;
      return;
    }
    if (!form.name.trim() || !form.price) return;
    const wasExisting = this.items.find(i => i.id === form.id);
    if (wasExisting && wasExisting.price !== form.price) {
      addAuditEvent({ action: 'price_change', userId: 'U01', userName: 'Nene Reyes', detail: `${form.name}: ₱${wasExisting.price} → ₱${form.price}`, severity: 'warn' });
    } else {
      addAuditEvent({ action: 'menu_add', userId: 'U01', userName: 'Nene Reyes', detail: `${this.isNew ? 'Added' : 'Updated'}: ${form.name}`, severity: 'info' });
    }
    try {
      const savedMenuId = await this.menu.saveMenuItem(form, this.isNew);
      if (this.isNew && this.setupNewRecipe) {
        this.inventory.saveRecipeMapping({
          menuItemId: savedMenuId,
          menuItemName: form.name,
          ingredients: this.recipeDraft
            .map(line => ({ ...line, qtyPerServing: Number(line.qtyPerServing) }))
            .filter(line => line.ingredientId && line.qtyPerServing > 0),
        });
      }
      this.showForm = false;
      this.cdr.markForCheck();
    } catch {
      alert('Could not save the menu item.');
    }
  }

  async handleDelete(id: string) {
    const item = this.items.find(i => i.id === id);
    if (item) addAuditEvent({ action: 'menu_delete', userId: 'U01', userName: 'Nene Reyes', detail: `Deleted: ${item.name}`, severity: 'warn' });
    try {
      await this.menu.deleteMenuItem(id);
    } catch {
      alert('Could not delete the menu item.');
    }
    this.confirmDelete = null;
    this.cdr.markForCheck();
  }

  closeOnBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.showForm = false;
  }

  addRecipeIngredient() {
    this.recipeDraft.push({ ingredientId: this.ingredients[0]?.id ?? '', qtyPerServing: 0 });
  }

  removeRecipeIngredient(index: number) {
    this.recipeDraft.splice(index, 1);
  }

  addModifier() {
    this.form.modifiers.push({ id: `md${Date.now()}`, name: '', options: [{ label: '', addPrice: 0 }], required: false });
  }
  removeModifier(idx: number) { this.form.modifiers.splice(idx, 1); }
  addOption(modIdx: number) { this.form.modifiers[modIdx].options.push({ label: '', addPrice: 0 }); }
  removeOption(modIdx: number, optIdx: number) { this.form.modifiers[modIdx].options.splice(optIdx, 1); }
}