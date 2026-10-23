import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../store/supabase.service'; // <-- ayusin ang path
import {
  Module9AvailabilityEvent, Module9Ingredient, Module9MenuItem, Module9MenuStatus,
} from '../core/models/module9.model';

@Injectable({ providedIn: 'root' })
export class Module9AvailabilityService {
  private readonly db = inject(SupabaseService).client;
  private readonly destroyRef = inject(DestroyRef);
  private reloadTimer = 0;

  readonly recipeSource = 'Module 17';
  readonly stockSource = 'Module 18';

  private readonly menuCatalog = signal<Module9MenuItem[]>([]);
  private readonly ingredientStock = signal<Module9Ingredient[]>([]);
  private readonly availabilityEventState = signal<Module9AvailabilityEvent[]>([]);

  readonly ingredients = computed(() => this.ingredientStock());
  readonly stockSignals = computed(() =>
    [...this.ingredientStock()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  );
  readonly availabilityEvents = computed(() => this.availabilityEventState());
  readonly menuStatuses = computed<Module9MenuStatus[]>(() =>
    this.menuCatalog().map((item) => this.evaluateItem(item, this.ingredientStock())),
  );
  readonly summary = computed(() => {
    const statuses = this.menuStatuses();
    const today = new Date().toDateString();
    return {
      menuItems: statuses.length,
      available: statuses.filter((i) => i.isAvailable).length,
      unavailable: statuses.filter((i) => !i.isAvailable).length,
      lowStockIngredients: this.ingredientStock().filter((i) => i.currentStock <= i.lowStockThreshold).length,
      eventsToday: this.availabilityEventState().filter((e) => e.eventTime.toDateString() === today).length,
    };
  });

  constructor() {
    const channel = this.db.channel('module9-live');
    for (const table of ['stock_signal', 'availability_event']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.scheduleReload());
    }
    channel.subscribe();
    this.destroyRef.onDestroy(() => {
      window.clearTimeout(this.reloadTimer);
      this.db.removeChannel(channel);
    });
    void this.load();
  }

  private scheduleReload(): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(), 300);
  }

  private async load(): Promise<void> {
    const [menu, recipes, ingredients, signals, events] = await Promise.all([
      this.db.from('menu').select('menu_id, menu_name, menu_category, price').order('menu_id'),
      this.db.from('recipe_item').select('menu_id, ingredient_id, required_quantity'),
      this.db.from('ingredient').select('ingredient_id, name, unit'),
      this.db.from('stock_signal').select('ingredient_id, current_stock, threshold, updated_at'),
      this.db.from('availability_event').select('*').order('event_time', { ascending: false }).limit(100),
    ]);
    const err = menu.error ?? recipes.error ?? ingredients.error ?? signals.error ?? events.error;
    if (err) { console.error('Module 9 load failed', err); return; }

    const recipeByMenu = new Map<number, { ingredientId: number; requiredQuantity: number }[]>();
    for (const r of (recipes.data ?? []) as any[]) {
      recipeByMenu.set(r.menu_id, [
        ...(recipeByMenu.get(r.menu_id) ?? []),
        { ingredientId: r.ingredient_id, requiredQuantity: Number(r.required_quantity) },
      ]);
    }
    const menuItems: Module9MenuItem[] = (menu.data ?? []).map((m: any) => ({
      id: m.menu_id,
      name: m.menu_name,
      category: String(m.menu_category).toUpperCase(),
      price: Number(m.price),
      recipe: recipeByMenu.get(m.menu_id) ?? [],
    }));

    const ingInfo = new Map<number, { name: string; unit: string }>(
      (ingredients.data ?? []).map((i: any) => [i.ingredient_id, { name: i.name, unit: i.unit ?? '' }]),
    );
    const stock: Module9Ingredient[] = (signals.data ?? []).flatMap((s: any) => {
      const info = ingInfo.get(s.ingredient_id);
      if (!info) return [];
      return [{
        id: s.ingredient_id,
        name: info.name,
        unit: info.unit,
        currentStock: Number(s.current_stock),
        lowStockThreshold: Number(s.threshold),
        updatedAt: new Date(s.updated_at ?? Date.now()),
      }];
    });

    const menuName = new Map(menuItems.map((m) => [m.id, m.name]));
    this.menuCatalog.set(menuItems);
    this.ingredientStock.set(stock);
    this.availabilityEventState.set((events.data ?? []).map((e: any) => ({
      id: e.event_id,
      menuItemId: e.menu_id,
      menuItemName: menuName.get(e.menu_id) ?? 'Item #' + e.menu_id,
      ingredientId: e.ingredient_id,
      ingredientName: ingInfo.get(e.ingredient_id)?.name ?? '-',
      eventType: e.event_type,
      eventTime: new Date(e.event_time),
    })));
  }

  private evaluateItem(item: Module9MenuItem, ingredients: Module9Ingredient[]): Module9MenuStatus {
    const blockers = item.recipe.flatMap((part) => {
      const ing = ingredients.find((i) => i.id === part.ingredientId);
      if (!ing || ing.currentStock >= part.requiredQuantity) return [];
      return [{ ingredientId: ing.id, name: ing.name, stock: ing.currentStock, required: part.requiredQuantity }];
    });
    return { ...item, isAvailable: blockers.length === 0, blockingIngredients: blockers };
  }

  // Stand-in ng Module 18: ina-update ang stock_signal; ang trigger na ang bahala sa menu at event
  receiveStockSignal(ingredientId: number, newStock: number): void {
    const ing = this.ingredientStock().find((i) => i.id === ingredientId);
    if (!ing) return;
    const stock = Math.max(0, Math.floor(Number.isFinite(newStock) ? newStock : 0));
    const now = new Date();
    this.ingredientStock.update((list) =>
      list.map((i) => (i.id === ingredientId ? { ...i, currentStock: stock, updatedAt: now } : i)),
    );
    void this.db.from('stock_signal')
      .upsert({ ingredient_id: ingredientId, current_stock: stock, threshold: ing.lowStockThreshold, updated_at: now.toISOString() },
              { onConflict: 'ingredient_id' })
      .then(({ error }) => {
        if (error) { console.error('receiveStockSignal failed', error); void this.load(); }
      });
  }

  ingredientFor(id: number | null): Module9Ingredient | undefined {
    return this.ingredientStock().find((i) => i.id === id);
  }

  dependentDishNames(ingredientId: number): string[] {
    return this.menuCatalog()
      .filter((item) => item.recipe.some((p) => p.ingredientId === ingredientId))
      .map((item) => item.name);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}