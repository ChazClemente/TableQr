import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { categories, type Category, type MenuItem } from '../..//data/menu';
import { CartService } from '../../services/cart.service';
import { MenuService } from '../../services/menu.service';
import { supabase } from '../../services/supabase';

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
  private suggestionRows = signal<{
    suggestion_id: number; unavailable_menu_id: number;
    suggested_menu_id: number; rank: number; shown_at: string;
  }[]>([]);

  // unavailable item id -> top available substitute
  suggestions = computed(() => {
    const byId = new Map(this.menu.items().map((i: MenuItem) => [String(i.id), i]));
    const rows = [...this.suggestionRows()]
      .sort((a, b) => b.shown_at.localeCompare(a.shown_at) || a.rank - b.rank);
    const out = new Map<string, { item: MenuItem; suggestionId: number }>();
    for (const r of rows) {
      const key = String(r.unavailable_menu_id);
      if (out.has(key)) continue;
      const un = byId.get(key);
      const sug = byId.get(String(r.suggested_menu_id));
      if (!un || un.available || !sug || !sug.available) continue;
      out.set(key, { item: sug, suggestionId: r.suggestion_id });
    }
    return out;
  });

  private async loadSuggestions() {
    const { data, error } = await supabase
      .from('substitution_suggestion')
      .select('suggestion_id, unavailable_menu_id, suggested_menu_id, rank, shown_at')
      .order('shown_at', { ascending: false })
      .limit(200);
    if (!error) this.suggestionRows.set(data ?? []);
  }

  async addSuggested(s: { item: MenuItem; suggestionId: number }) {
    this.handleAdd(s.item);
    try {
      await supabase.from('substitution_suggestion')
        .update({ accepted: true })
        .eq('suggestion_id', s.suggestionId);
    } catch { /* hindi hadlang sa pag-order */ }
  }

  loading = this.menu.loading;
  error = this.menu.error;
  // loading screen lang sa unang load; tahimik ang mga susunod na refresh
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
    void this.loadSuggestions();
    const iv = setInterval(() => { this.menu.load(); void this.loadSuggestions(); }, 8000);
    inject(DestroyRef).onDestroy(() => clearInterval(iv));
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