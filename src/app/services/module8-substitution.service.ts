import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../store/supabase.service';// <-- fix the path
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

  // Latest batch of suggestions for the selected unavailable dish
  readonly suggestions = computed<Module8Suggestion[]>(() => {
    const u = this.unavailableItem();
    return u ? this.suggestionsFor(u.id) : [];
  });

  suggestionsFor(unavailableMenuItemId: number): Module8Suggestion[] {
    const u = this.menuItems().find((item) => item.id === unavailableMenuItemId && !item.isAvailable);
    if (!u) return [];
    const rows = this.log().filter((l) => l.unavailableMenuItemId === u.id);
    if (!rows.length) return [];
    const latest = Math.max(...rows.map((r) => r.shownAt.getTime()));
    const rules = this.rules().filter((r) => r.unavailableMenuItemId === u.id);
    const preferredIds = new Set(rules.filter((r) => r.ruleType === 'preferred').map((r) => r.targetMenuItemId));
    const excludedIds = new Set(rules.filter((r) => r.ruleType === 'excluded').map((r) => r.targetMenuItemId));
    return rows
      .filter((r) => r.shownAt.getTime() === latest)
      .filter((r) => !excludedIds.has(r.suggestedMenuItemId))
      .flatMap((r) => {
        const m = this.menuItems().find((x) => x.id === r.suggestedMenuItemId);
        if (!m?.isAvailable || m.category !== u.category) return [];
        return [{
          suggestionId: r.id,
          menuItem: m,
          rank: r.rank,
          preferred: preferredIds.has(m.id),
          categoryMatch: m.category === u.category,
          ingredientMatches: m.ingredients.filter((i) => u.ingredients.includes(i)),
        }];
      })
      .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.rank - b.rank)
      .slice(0, 2);
  }

  readonly acceptanceRate = computed(() => {
    const decided = this.log().filter((e) => e.accepted !== null);
    return decided.length ? Math.round((decided.filter((e) => e.accepted).length / decided.length) * 100) : null;
  });

  constructor() {
    const channel = this.db.channel('module8-live');
    for (const table of ['availability_event', 'substitution_suggestion', 'substitution_config_rule']) {
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

  private async load(): Promise<boolean> {
    const [menu, recipes, rules, sugg] = await Promise.all([
      this.db.from('menu').select('menu_id, menu_name, menu_category, price, stock_status, image_url').order('menu_id'),
      this.db.from('recipe_item').select('menu_id, ingredient(name)'),
      this.db.from('substitution_config_rule').select('*').order('updated_at', { ascending: false }),
      this.db.from('substitution_suggestion').select('*').order('shown_at', { ascending: false }).limit(200),
    ]);
    if (menu.error || recipes.error || rules.error || sugg.error) {
      console.error('Module 8 load failed', menu.error ?? recipes.error ?? rules.error ?? sugg.error);
      return false;
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
      imageUrl: m.image_url ?? undefined,
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
    return true;
  }

  async saveRule(ruleType: Module8RuleType, targetMenuItemId: number): Promise<void> {
    const u = this.unavailableItem();
    const target = this.menuItems().find((item) => item.id === targetMenuItemId);
    if (!u || !target?.isAvailable || target.id === u.id || target.category !== u.category) {
      throw new Error('Choose an available substitute in the same category.');
    }
    // only one rule per (unavailable, target)
    const { error: deleteError } = await this.db.from('substitution_config_rule')
      .delete().eq('menu_id', u.id).eq('target_menu_id', targetMenuItemId);
    if (deleteError) throw deleteError;
    const { error } = await this.db.from('substitution_config_rule')
      .insert({ menu_id: u.id, rule_type: ruleType, target_menu_id: targetMenuItemId });
    if (error) throw error;
    if (!(await this.load())) {
      throw new Error('Rule saved, but current recommendations could not be refreshed.');
    }
    try {
      await this.publishRankedSuggestions(u.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'updated suggestions could not be published.';
      throw new Error(`Rule saved, but ${detail}`);
    }
  }

  async removeRule(ruleId: number): Promise<void> {
    const rule = this.rules().find((item) => item.id === ruleId);
    if (!rule) return;
    const { error } = await this.db.from('substitution_config_rule').delete().eq('rule_id', ruleId);
    if (error) throw error;
    if (!(await this.load())) {
      throw new Error('Rule removed, but current recommendations could not be refreshed.');
    }
    try {
      await this.publishRankedSuggestions(rule.unavailableMenuItemId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'updated suggestions could not be published.';
      throw new Error(`Rule removed, but ${detail}`);
    }
  }

  private async publishRankedSuggestions(unavailableMenuItemId: number): Promise<void> {
    const unavailable = this.menuItems().find((item) => item.id === unavailableMenuItemId && !item.isAvailable);
    if (!unavailable) return;

    const previousRows = this.log().filter((row) => row.unavailableMenuItemId === unavailableMenuItemId);
    const latestShownAt = Math.max(...previousRows.map((row) => row.shownAt.getTime()), 0);
    const previousRanks = new Map(
      previousRows
        .filter((row) => row.shownAt.getTime() === latestShownAt)
        .map((row) => [row.suggestedMenuItemId, row.rank]),
    );
    const rules = this.rules().filter((rule) => rule.unavailableMenuItemId === unavailableMenuItemId);
    const preferredIds = new Set(rules.filter((rule) => rule.ruleType === 'preferred').map((rule) => rule.targetMenuItemId));
    const excludedIds = new Set(rules.filter((rule) => rule.ruleType === 'excluded').map((rule) => rule.targetMenuItemId));
    const ranked = this.menuItems()
      .filter((item) =>
        item.isAvailable
        && item.id !== unavailableMenuItemId
        && item.category === unavailable.category
        && !excludedIds.has(item.id),
      )
      .map((menuItem) => ({
        menuItem,
        preferred: preferredIds.has(menuItem.id),
        ingredientMatches: menuItem.ingredients.filter((ingredient) => unavailable.ingredients.includes(ingredient)),
        previousRank: previousRanks.get(menuItem.id) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) =>
        Number(b.preferred) - Number(a.preferred)
        || b.ingredientMatches.length - a.ingredientMatches.length
        || a.previousRank - b.previousRank
        || a.menuItem.id - b.menuItem.id,
      )
      .slice(0, 2);

    if (!ranked.length) return;

    const shownAt = new Date().toISOString();
    const { error } = await this.db.from('substitution_suggestion').insert(
      ranked.map((suggestion, index) => ({
        unavailable_menu_id: unavailableMenuItemId,
        suggested_menu_id: suggestion.menuItem.id,
        rank: index + 1,
        shown_at: shownAt,
        accepted: null,
      })),
    );
    if (error) {
      console.error('Publishing ranked suggestions failed', error);
      throw new Error('updated suggestions could not be published.');
    }
    if (!(await this.load())) {
      throw new Error('updated suggestions could not be reloaded.');
    }
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