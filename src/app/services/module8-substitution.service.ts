import { Injectable, computed, signal } from '@angular/core';
import {
  Module8ConfigRule,
  Module8MenuItem,
  Module8RuleType,
  Module8Suggestion,
  Module8SuggestionLog,
  Module8UnavailableEvent,
} from '../core/models/module8.model';

const now = () => new Date();

@Injectable({ providedIn: 'root' })
export class Module8SubstitutionService {
  readonly menuItems = signal<Module8MenuItem[]>([
    { id: 'sisig', name: 'Sizzling Pork Sisig', category: 'ULAM', ingredients: ['pork', 'onion', 'garlic', 'calamansi'], price: 245, isAvailable: false },
    { id: 'chicken-adobo', name: 'Chicken Adobo', category: 'ULAM', ingredients: ['chicken', 'soy sauce', 'garlic', 'onion'], price: 220, isAvailable: true },
    { id: 'pork-bbq', name: 'Pork BBQ', category: 'ULAM', ingredients: ['pork', 'soy sauce', 'garlic'], price: 195, isAvailable: true },
    { id: 'crispy-pata', name: 'Crispy Pata', category: 'ULAM', ingredients: ['pork', 'garlic', 'pepper'], price: 395, isAvailable: true },
    { id: 'ensaladang-talong', name: 'Ensaladang Talong', category: 'PAMPAGANA', ingredients: ['eggplant', 'tomato', 'onion'], price: 145, isAvailable: true },
    { id: 'bulalo', name: 'Bulalo Batangas', category: 'SABAW', ingredients: ['beef', 'corn', 'cabbage', 'onion'], price: 365, isAvailable: true },
  ]);

  readonly unavailableEvent = signal<Module8UnavailableEvent>({
    id: 'AV-3081',
    menuItemId: 'sisig',
    occurredAt: now(),
    source: 'Module 9',
  });

  readonly rules = signal<Module8ConfigRule[]>([
    { id: 'rule-pref-1', unavailableMenuItemId: 'sisig', ruleType: 'preferred-substitute', targetMenuItemId: 'chicken-adobo', updatedAt: now() },
    { id: 'rule-excl-1', unavailableMenuItemId: 'sisig', ruleType: 'exclude-substitute', targetMenuItemId: 'crispy-pata', updatedAt: now() },
  ]);
  private readonly eventRulesState = signal<Module8ConfigRule[]>(this.rules());

  readonly unavailableItem = computed(() =>
    this.menuItems().find((item) => item.id === this.unavailableEvent().menuItemId),
  );
  readonly excludedByRule = computed(() =>
    this.eventRulesState().some(
      (rule) => rule.unavailableMenuItemId === this.unavailableEvent().menuItemId && rule.ruleType === 'exclude-item',
    ),
  );
  readonly suggestions = computed<Module8Suggestion[]>(() => {
    const unavailable = this.unavailableItem();
    if (!unavailable || this.excludedByRule()) return [];
    const rules = this.eventRulesState().filter((rule) => rule.unavailableMenuItemId === unavailable.id);
    const excludedIds = new Set(
      rules.filter((rule) => rule.ruleType === 'exclude-substitute').map((rule) => rule.targetMenuItemId),
    );
    const preferredIds = new Set(
      rules.filter((rule) => rule.ruleType === 'preferred-substitute').map((rule) => rule.targetMenuItemId),
    );
    const adjacent: Record<string, string[]> = {
      ULAM: ['PAMPAGANA', 'SABAW'],
      SABAW: ['ULAM', 'PAMPAGANA'],
      PAMPAGANA: ['ULAM', 'MERIENDA'],
      MERIENDA: ['PAMPAGANA', 'INUMIN'],
      INUMIN: ['MERIENDA'],
      'KANIN & PANSIT': ['ULAM'],
    };
    return this.menuItems()
      .filter((candidate) => candidate.id !== unavailable.id && candidate.isAvailable && !excludedIds.has(candidate.id))
      .filter((candidate) => candidate.category === unavailable.category || adjacent[unavailable.category]?.includes(candidate.category))
      .map((menuItem) => ({
        menuItem,
        rank: 0,
        preferred: preferredIds.has(menuItem.id),
        categoryMatch: menuItem.category === unavailable.category,
        ingredientMatches: menuItem.ingredients.filter((ingredient) => unavailable.ingredients.includes(ingredient)),
      }))
      .sort((a, b) =>
        Number(b.preferred) - Number(a.preferred)
        || Number(b.categoryMatch) - Number(a.categoryMatch)
        || b.ingredientMatches.length - a.ingredientMatches.length
        || a.menuItem.name.localeCompare(b.menuItem.name),
      )
      .slice(0, 2)
      .map((suggestion, index) => ({ ...suggestion, rank: index + 1 }));
  });

  readonly log = signal<Module8SuggestionLog[]>([]);
  readonly currentDecision = signal<{ selectedMenuItemId?: string; proceededWithout: boolean } | null>(null);
  private readonly currentShownAtState = signal(now());
  readonly shownCount = computed(() => this.log().length);
  readonly acceptedCount = computed(() => this.log().filter((entry) => entry.accepted === true).length);
  readonly acceptanceRate = computed(() => {
    const decided = this.log().filter((entry) => entry.accepted !== null);
    return decided.length ? Math.round((decided.filter((entry) => entry.accepted).length / decided.length) * 100) : null;
  });

  constructor() {
    this.recordSuggestionsShown();
  }

  recordSuggestionsShown(): void {
    const unavailable = this.unavailableItem();
    if (!unavailable) return;
    const shownAt = now();
    this.currentShownAtState.set(shownAt);
    const entries = this.suggestions().map((suggestion) => ({
      id: this.unavailableEvent().id + ':' + shownAt.getTime() + ':' + suggestion.menuItem.id,
      unavailableMenuItemId: unavailable.id,
      suggestedMenuItemId: suggestion.menuItem.id,
      rank: suggestion.rank,
      shownAt,
      accepted: null,
    }));
    this.log.update((current) => [...entries, ...current]);
    this.currentDecision.set(null);
  }

  receiveNextUnavailableEvent(): void {
    const unavailable = this.unavailableItem();
    if (!unavailable) return;
    this.unavailableEvent.set({
      id: 'AV-' + Date.now(),
      menuItemId: unavailable.id,
      occurredAt: now(),
      source: 'Module 9',
    });
    this.eventRulesState.set([...this.rules()]);
    this.recordSuggestionsShown();
  }

  chooseSubstitute(menuItemId: string): void {
    if (this.currentDecision()) return;
    this.currentDecision.set({ selectedMenuItemId: menuItemId, proceededWithout: false });
    const shownAt = this.currentShownAtState().getTime();
    this.log.update((entries) =>
      entries.map((entry) => entry.unavailableMenuItemId === this.unavailableEvent().menuItemId && entry.shownAt.getTime() === shownAt
        ? { ...entry, accepted: entry.suggestedMenuItemId === menuItemId }
        : entry),
    );
  }

  proceedWithoutSubstitute(): void {
    if (this.currentDecision()) return;
    this.currentDecision.set({ proceededWithout: true });
    const shownAt = this.currentShownAtState().getTime();
    this.log.update((entries) => entries.map((entry) =>
      entry.unavailableMenuItemId === this.unavailableEvent().menuItemId && entry.shownAt.getTime() === shownAt
        ? { ...entry, accepted: false }
        : entry,
    ));
  }

  saveRule(ruleType: Module8RuleType, targetMenuItemId?: string): void {
    const unavailable = this.unavailableItem();
    if (!unavailable) return;
    const needsTarget = ruleType !== 'exclude-item';
    if (needsTarget && !targetMenuItemId) return;
    const rule: Module8ConfigRule = {
      id: 'rule-' + Date.now(),
      unavailableMenuItemId: unavailable.id,
      ruleType,
      targetMenuItemId: needsTarget ? targetMenuItemId : undefined,
      updatedAt: now(),
    };
    this.rules.update((rules) => [...rules, rule]);
  }

  removeRule(ruleId: string): void {
    this.rules.update((rules) => rules.filter((rule) => rule.id !== ruleId));
  }

  ruleDescription(rule: Module8ConfigRule): string {
    const target = this.menuItems().find((item) => item.id === rule.targetMenuItemId);
    if (rule.ruleType === 'exclude-item') return 'Hide all substitute suggestions for this unavailable dish';
    if (rule.ruleType === 'exclude-substitute') return 'Do not suggest ' + (target?.name ?? 'this dish');
    return 'Prefer ' + (target?.name ?? 'this dish') + ' in the ranking';
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
