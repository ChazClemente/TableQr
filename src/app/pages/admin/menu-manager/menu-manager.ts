import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Category } from '../../../data/menu';
import { MenuStore, type ManagedMenuItem } from '../../../store/menu-store';
import { addAuditEvent } from '../../../store/user-store';

const CAT_COLORS = ['#7A3B1E', '#4A7C59', '#8B6914', '#5C2E0A', '#C0392B', '#2C6080'];

const BLANK: ManagedMenuItem = {
  id: '', name: '', description: '', price: 0, category: 'Ulam',
  available: true, popular: false, image: '', modifiers: [], tags: [],
};

@Component({
  selector: 'app-menu-manager',
  imports: [RouterLink, FormsModule],
  templateUrl: './menu-manager.html',
})
export class MenuManager {
  private menu = inject(MenuStore);
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
  confirmDelete: string | null = null;

  toggleAvailable(id: string) { return this.menu.toggleAvailable(id); }

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
    this.showForm = true;
  }

  openEdit(item: ManagedMenuItem) {
    this.form = structuredClone(item);
    this.isNew = false;
    this.showForm = true;
  }

    async handleSave() {
    const form = this.form;
    if (!form.name || !form.price) return;
    const wasExisting = this.items.find(i => i.id === form.id);
    if (wasExisting && wasExisting.price !== form.price) {
      addAuditEvent({ action: 'price_change', userId: 'U01', userName: 'Nene Reyes', detail: `${form.name}: ₱${wasExisting.price} → ₱${form.price}`, severity: 'warn' });
    } else {
      addAuditEvent({ action: 'menu_add', userId: 'U01', userName: 'Nene Reyes', detail: `${this.isNew ? 'Added' : 'Updated'}: ${form.name}`, severity: 'info' });
    }
    try {
      await this.menu.saveMenuItem(form, this.isNew);
      this.showForm = false;
    } catch {
      alert('Hindi na-save ang menu item.');
    }
  }

  async handleDelete(id: string) {
    const item = this.items.find(i => i.id === id);
    if (item) addAuditEvent({ action: 'menu_delete', userId: 'U01', userName: 'Nene Reyes', detail: `Deleted: ${item.name}`, severity: 'warn' });
    try {
      await this.menu.deleteMenuItem(id);
    } catch {
      alert('Hindi nabura ang menu item.');
    }
    this.confirmDelete = null;
  }

  closeOnBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.showForm = false;
  }

  addModifier() {
    this.form.modifiers.push({ id: `md${Date.now()}`, name: '', options: [{ label: '', addPrice: 0 }], required: false });
  }
  removeModifier(idx: number) { this.form.modifiers.splice(idx, 1); }
  addOption(modIdx: number) { this.form.modifiers[modIdx].options.push({ label: '', addPrice: 0 }); }
  removeOption(modIdx: number, optIdx: number) { this.form.modifiers[modIdx].options.splice(optIdx, 1); }
}