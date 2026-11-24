import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { categories, type Category, type MenuItem } from '../..//data/menu';
import { CartService } from '../../services/cart.service';
import { MenuService } from '../../services/menu.service';
import { supabase } from '../../services/supabase';
import { Module8SubstitutionService } from '../../services/module8-substitution.service';

@Component({
  selector: 'app-menu',
  imports: [FormsModule, RouterLink],
  templateUrl: './menu.html',
})
export class Menu {
  private route = inject(ActivatedRoute);
  private cart = inject(CartService);
  private menu = inject(MenuService);
  private substitution = inject(Module8SubstitutionService);

  tableId = toSignal(this.route.paramMap.pipe(map(p => p.get('tableId'))), { initialValue: null });

  categories = categories;
  activeCategory = signal<Category>('Soup');
  addedId = signal<string | null>(null);
  search = signal('');

  // Kiosk-style home: null = category tiles, otherwise the open category's dishes
  openCategory = signal<Category | null>(null);

  // One tile per category that has dishes, showing the best seller's photo
  categoryTiles = computed(() => {
    const items = this.menu.items();
    const byCat = new Map<string, MenuItem[]>();
    for (const i of items) {
      if (!byCat.has(i.category)) byCat.set(i.category, []);
      byCat.get(i.category)!.push(i);
    }
    const known = this.categories.filter(c => byCat.has(c));
    const extra = [...byCat.keys()].filter(c => !this.categories.includes(c));
    return [...known, ...extra].map(name => {
      const list = byCat.get(name)!;
      const best =
        list.find(i => i.popular && i.available) ?? list.find(i => i.popular);
      const pick =
        (best && best.image ? best : undefined) ??
        list.find(i => i.available && i.image) ??
        list.find(i => i.image);
      return {
        name,
        count: list.length,
        availableCount: list.filter(i => i.available).length,
        image: pick?.image ?? '',
        bestSeller: best?.name ?? '',
      };
    });
  });

  // Dishes to list: search across everything, or the open category
  listItems = computed(() => {
    const q = this.search().trim().toLowerCase();
    const open = this.openCategory();
    const all = this.menu.items();
    if (q) {
      return all.filter(
        (i: MenuItem) => (!open || i.category === open) && i.name.toLowerCase().includes(q),
      );
    }
    return open ? all.filter((i: MenuItem) => i.category === open) : [];
  });

  showTiles = computed(() => this.openCategory() === null && !this.search().trim());

  // Best sellers row on the kiosk home
  bestSellers = computed(() =>
    this.menu.items().filter((i: MenuItem) => i.popular && i.available).slice(0, 8),
  );

  // Cart summary bar (bottom of the kiosk)
  cartCount = this.cart.count;
  cartTotal = this.cart.total;

  private scrollTop() {
    document.getElementById('menu-pane')?.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // Unavailable item id -> its two highest-ranked, rule-filtered substitutes.
  suggestions = computed(() => {
    const menuItems = new Map(this.menu.items().map((item: MenuItem) => [String(item.id), item]));
    const out = new Map<string, { item: MenuItem; suggestionId: number }[]>();
    for (const unavailable of this.menu.items().filter((item: MenuItem) => !item.available)) {
      const ranked = this.substitution.suggestionsFor(Number(unavailable.id)).flatMap((suggestion) => {
        const item = menuItems.get(String(suggestion.menuItem.id));
        return item?.available ? [{ item, suggestionId: suggestion.suggestionId }] : [];
      });
      if (ranked.length) out.set(String(unavailable.id), ranked);
    }
    return out;
  });

  async addSuggested(s: { item: MenuItem; suggestionId: number }) {
    this.handleAdd(s.item);
    try {
      const { error } = await supabase.from('substitution_suggestion')
        .update({ accepted: true })
        .eq('suggestion_id', s.suggestionId);
      if (error) console.error('Could not record accepted substitution', error);
    } catch (error) {
      console.error('Could not record accepted substitution', error);
    }
  }

  loading = this.menu.loading;
  error = this.menu.error;
  // loading screen only on the first load; later refreshes are silent
  showLoading = computed(() => this.loading() && this.menu.items().length === 0);
  filtered = computed(() => {
    const cat = this.activeCategory();
    const q = this.search().toLowerCase();
    return this.menu
      .items()
      .filter((item: MenuItem) => item.category === cat && (!q || item.name.toLowerCase().includes(q)));
  });

  constructor() {
    this.menu.load();
    const iv = setInterval(() => this.menu.load(), 8000);
    inject(DestroyRef).onDestroy(() => clearInterval(iv));
  }
  reload() {
    this.menu.load();
  }

  selectCategory(cat: Category) {
    this.activeCategory.set(cat);
    this.search.set('');
  }

  openCat(cat: Category) {
    this.selectCategory(cat);
    this.openCategory.set(cat);
    this.scrollTop();
  }

  backToCategories() {
    this.openCategory.set(null);
    this.search.set('');
    this.scrollTop();
  }

  handleAdd(item: MenuItem) {
    if (!item.available) return;
    this.cart.addToCart(item);
    this.addedId.set(item.id);
    setTimeout(() => this.addedId.set(null), 1200);
  }
}