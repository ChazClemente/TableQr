import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../store/supabase.service';// <-- ayusin ang path
import {
  Module8ConfigRule, Module8MenuItem, Module8RuleType,
  Module8Suggestion, Module8SuggestionLog,
} from '../core/models/module8.model';

const one = <T>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

@Injectable({ providedIn: 'root' })
export class Module8SubstitutionService {
  private readonly db = inject(SupabaseService).client;
  private readonly destroyRef = inject(DestroyRef);
  private reloadTimer = 0;

  readonly menuItems = signal<Module8MenuItem[]>([]);
  readonly rules = signal<Module8ConfigRule[]>([]);
  readonly log = signal<Module8SuggestionLog[]>([]);
  private readonly selectedId = signal<number | null>(null);

  readonly unavailableItems = computed(() => this.menuItems().filter((m) => !m.isAvailable));
  readonly unavailableItem = computed(() => {
    const list = this.unavailableItems();
    return list.find((m) => m.id === this.selectedId()) ?? list[0] ?? null;
  });

  readonly itemRules = computed(() => {
    const u = this.unavailableItem();
    return u ? this.rules().filter((r) => r.unavailableMenuItemId === u.id) : [];
  });

  // Pinakabagong batch ng mungkahi para sa napiling unavailable na ulam
  readonly suggestions = computed<Module8Suggestion[]>(() => {
    const u = this.unavailableItem();
    if (!u) return [];
    const rows = this.log().filter((l) => l.unavailableMenuItemId === u.id);
    if (!rows.length) return [];
    const latest = Math.max(...rows.map((r) => r.shownAt.getTime()));
    const preferredIds = new Set(this.itemRules().filter((r) => r.ruleType === 'preferred').map((r) => r.targetMenuItemId));
    return rows
      .filter((r) => r.shownAt.getTime() === latest)
      .sort((a, b) => a.rank - b.rank)
      .flatMap((r) => {
        const m = this.menuItems().find((x) => x.id === r.suggestedMenuItemId);
        if (!m) return [];
        return [{
          menuItem: m,
          rank: r.rank,
          preferred: preferredIds.has(m.id),
          categoryMatch: m.category === u.category,
          ingredientMatches: m.ingredients.filter((i) => u.ingredients.includes(i)),
        }];
      });
  });

  readonly acceptanceRate = computed(() => {
    const decided = this.log().filter((e) => e.accepted !== null);
    return decided.length ? Math.round((decided.filter((e) => e.accepted).length / decided.length) * 100) : null;
  });

  constructor() {
    const channel = this.db.channel('module8-live');
    for (const table of ['availability_event', 'substitution_suggestion']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.scheduleReload());
    }
    channel.subscribe();
    this.destroyRef.onDestroy(() => {
      window.clearTimeout(this.reloadTimer);
      this.db.removeChannel(channel);
    });
    void this.load();
  }

  select(id: number): void {
    this.selectedId.set(id);
  }

  private scheduleReload(): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(), 300);
  }

  private async load(): Promise<void> {
    const [menu, recipes, rules, sugg] = await Promise.all([
      this.db.from('menu').select('menu_id, menu_name, menu_category, price, stock_status').order('menu_id'),
      this.db.from('recipe_item').select('menu_id, ingredient(name)'),
      this.db.from('substitution_config_rule').select('*').order('updated_at', { ascending: false }),
      this.db.from('substitution_suggestion').select('*').order('shown_at', { ascending: false }).limit(200),
    ]);
    if (menu.error || recipes.error || rules.error || sugg.error) {
      console.error('Module 8 load failed', menu.error ?? recipes.error ?? rules.error ?? sugg.error);
      return;
    }

    const ingredientsByMenu = new Map<number, string[]>();
    for (const r of (recipes.data ?? []) as any[]) {
      const name = one<{ name: string }>(r.ingredient)?.name;
      if (!name) continue;
      ingredientsByMenu.set(r.menu_id, [...(ingredientsByMenu.get(r.menu_id) ?? []), name.toLowerCase()]);
    }

    this.menuItems.set((menu.data ?? []).map((m: any) => ({
      id: m.menu_id,
      name: m.menu_name,
      category: String(m.menu_category).toUpperCase(),
      ingredients: ingredientsByMenu.get(m.menu_id) ?? [],
      price: Number(m.price),
      isAvailable: m.stock_status === 'available',
    })));

    this.rules.set((rules.data ?? []).map((r: any) => ({
      id: r.rule_id,
      unavailableMenuItemId: r.menu_id,
      ruleType: r.rule_type as Module8RuleType,
      targetMenuItemId: r.target_menu_id,
      updatedAt: new Date(r.updated_at),
    })));

    this.log.set((sugg.data ?? []).map((s: any) => ({
      id: s.suggestion_id,
      unavailableMenuItemId: s.unavailable_menu_id,
      suggestedMenuItemId: s.suggested_menu_id,
      rank: s.rank,
      shownAt: new Date(s.shown_at),
      accepted: s.accepted,
    })));
  }

  async saveRule(ruleType: Module8RuleType, targetMenuItemId: number): Promise<void> {
    const u = this.unavailableItem();
    if (!u || !targetMenuItemId) return;
    // isang rule lang kada (unavailable, target)
    await this.db.from('substitution_config_rule').delete().eq('menu_id', u.id).eq('target_menu_id', targetMenuItemId);
    const { error } = await this.db.from('substitution_config_rule')
      .insert({ menu_id: u.id, rule_type: ruleType, target_menu_id: targetMenuItemId });
    if (error) console.error('saveRule failed', error);
    void this.load();
  }

  removeRule(ruleId: number): void {
    this.rules.update((rs) => rs.filter((r) => r.id !== ruleId));
    void this.db.from('substitution_config_rule').delete().eq('rule_id', ruleId).then(({ error }) => {
      if (error) { console.error('removeRule failed', error); void this.load(); }
    });
  }

  menuItemName(id: number): string {
    return this.menuItems().find((m) => m.id === id)?.name ?? String(id);
  }

  ruleDescription(rule: Module8ConfigRule): string {
    const name = this.menuItemName(rule.targetMenuItemId);
    return rule.ruleType === 'excluded' ? 'Do not suggest ' + name : 'Prefer ' + name + ' in the ranking';
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}