import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { categories, type Category, type MenuItem } from '../..//data/menu';
import { CartService } from '../../services/cart.service';
import { MenuService } from '../../services/menu.service';

@Component({
  selector: 'app-menu',
  imports: [FormsModule],
  templateUrl: './menu.html',
})
export class Menu {
  private route = inject(ActivatedRoute);
  private cart = inject(CartService);
  private menu = inject(MenuService);

  tableId = toSignal(this.route.paramMap.pipe(map(p => p.get('tableId'))), { initialValue: null });

  categories = categories;
  activeCategory = signal<Category>('Soup');
  addedId = signal<string | null>(null);
  search = signal('');

  loading = this.menu.loading;
  error = this.menu.error;

  filtered = computed(() => {
    const cat = this.activeCategory();
    const q = this.search().toLowerCase();
    return this.menu
      .items()
      .filter((item: MenuItem) => item.category === cat && (!q || item.name.toLowerCase().includes(q)));
  });

  constructor() {
    this.menu.load();
  }

  reload() {
    this.menu.load();
  }

  selectCategory(cat: Category) {
    this.activeCategory.set(cat);
    this.search.set('');
  }

  handleAdd(item: MenuItem) {
    if (!item.available) return;
    this.cart.addToCart(item);
    this.addedId.set(item.id);
    setTimeout(() => this.addedId.set(null), 1200);
  }
}