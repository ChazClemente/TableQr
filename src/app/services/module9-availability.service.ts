import { Injectable, computed, signal } from '@angular/core';
import {
  Module9AvailabilityEvent,
  Module9Ingredient,
  Module9MenuItem,
  Module9MenuStatus,
  Module9StockSignal,
} from '../core/models/module9.model';

const stockSeed: Module9Ingredient[] = [
  { id: 'pork', name: 'Pork portions', currentStock: 3, unit: 'portions', lowStockThreshold: 6 },
  { id: 'chicken', name: 'Chicken portions', currentStock: 16, unit: 'portions', lowStockThreshold: 5 },
  { id: 'beef', name: 'Beef portions', currentStock: 12, unit: 'portions', lowStockThreshold: 4 },
  { id: 'onion', name: 'Onions', currentStock: 9, unit: 'pcs', lowStockThreshold: 5 },
  { id: 'garlic', name: 'Garlic', currentStock: 8, unit: 'heads', lowStockThreshold: 4 },
  { id: 'rice', name: 'Rice', currentStock: 18, unit: 'cups', lowStockThreshold: 8 },
];

const menuSeed: Module9MenuItem[] = [
  { id: 'sisig', name: 'Sizzling Pork Sisig', category: 'ULAM', price: 245, recipe: [{ ingredientId: 'pork', requiredQuantity: 5 }, { ingredientId: 'onion', requiredQuantity: 1 }, { ingredientId: 'garlic', requiredQuantity: 1 }] },
  { id: 'pork-bbq', name: 'Pork BBQ', category: 'ULAM', price: 195, recipe: [{ ingredientId: 'pork', requiredQuantity: 3 }, { ingredientId: 'garlic', requiredQuantity: 1 }] },
  { id: 'crispy-pata', name: 'Crispy Pata', category: 'PAMPAGANA', price: 395, recipe: [{ ingredientId: 'pork', requiredQuantity: 8 }, { ingredientId: 'garlic', requiredQuantity: 2 }] },
  { id: 'chicken-adobo', name: 'Chicken Adobo', category: 'ULAM', price: 220, recipe: [{ ingredientId: 'chicken', requiredQuantity: 4 }, { ingredientId: 'onion', requiredQuantity: 1 }, { ingredientId: 'garlic', requiredQuantity: 1 }] },
  { id: 'bulalo', name: 'Bulalo Batangas', category: 'SABAW', price: 365, recipe: [{ ingredientId: 'beef', requiredQuantity: 4 }, { ingredientId: 'onion', requiredQuantity: 1 }] },
  { id: 'sinangag', name: 'Sinangag at Itlog', category: 'KANIN & PANSIT', price: 95, recipe: [{ ingredientId: 'rice', requiredQuantity: 2 }] },
];

@Injectable({ providedIn: 'root' })
export class Module9AvailabilityService {
  readonly menuCatalog = menuSeed;
  readonly recipeSource = 'Module 17';
  readonly stockSource = 'Module 18';
  private readonly ingredientStock = signal<Module9Ingredient[]>(stockSeed);
  private readonly stockSignalState = signal<Module9StockSignal[]>([
    { id: 'STK-0181', ingredientId: 'pork', previousStock: 7, currentStock: 3, receivedAt: new Date(Date.now() - 4 * 60_000), source: 'Module 18' },
  ]);
  private readonly availabilityEventState = signal<Module9AvailabilityEvent[]>([
    { id: 'AVL-0901', menuItemId: 'sisig', menuItemName: 'Sizzling Pork Sisig', ingredientId: 'pork', ingredientName: 'Pork portions', eventType: 'suppressed', previousStock: 7, currentStock: 3, eventTime: new Date(Date.now() - 4 * 60_000), stockSignalId: 'STK-0181' },
    { id: 'AVL-0902', menuItemId: 'crispy-pata', menuItemName: 'Crispy Pata', ingredientId: 'pork', ingredientName: 'Pork portions', eventType: 'suppressed', previousStock: 7, currentStock: 3, eventTime: new Date(Date.now() - 4 * 60_000), stockSignalId: 'STK-0181' },
  ]);

  readonly ingredients = computed(() => this.ingredientStock());
  readonly stockSignals = computed(() =>
    [...this.stockSignalState()].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()),
  );
  readonly availabilityEvents = computed(() =>
    [...this.availabilityEventState()].sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime()),
  );
  readonly menuStatuses = computed<Module9MenuStatus[]>(() =>
    this.menuCatalog.map((item) => this.evaluateItem(item, this.ingredientStock())),
  );
  readonly summary = computed(() => {
    const statuses = this.menuStatuses();
    return {
      menuItems: statuses.length,
      available: statuses.filter((item) => item.isAvailable).length,
      unavailable: statuses.filter((item) => !item.isAvailable).length,
      lowStockIngredients: this.ingredientStock().filter((ingredient) => ingredient.currentStock <= ingredient.lowStockThreshold).length,
      eventsToday: this.availabilityEventState().length,
    };
  });

  private evaluateItem(item: Module9MenuItem, ingredients: Module9Ingredient[]): Module9MenuStatus {
    const blockers = item.recipe.flatMap((recipePart) => {
      const ingredient = ingredients.find((entry) => entry.id === recipePart.ingredientId);
      if (!ingredient || ingredient.currentStock >= recipePart.requiredQuantity) return [];
      return [{
        ingredientId: ingredient.id,
        name: ingredient.name,
        stock: ingredient.currentStock,
        required: recipePart.requiredQuantity,
      }];
    });
    return { ...item, isAvailable: blockers.length === 0, blockingIngredients: blockers };
  }

  receiveStockSignal(ingredientId: string, newStock: number): void {
    const currentIngredients = this.ingredientStock();
    const ingredient = currentIngredients.find((entry) => entry.id === ingredientId);
    if (!ingredient) return;
    const stock = Math.max(0, Math.floor(Number.isFinite(newStock) ? newStock : 0));
    const receivedAt = new Date();
    const before = new Map(this.menuCatalog.map((item) => [item.id, this.evaluateItem(item, currentIngredients)]));
    const nextIngredients = currentIngredients.map((entry) =>
      entry.id === ingredientId ? { ...entry, currentStock: stock } : entry,
    );
    const signalId = 'STK-' + receivedAt.getTime();
    this.ingredientStock.set(nextIngredients);
    this.stockSignalState.update((signals) => [
      { id: signalId, ingredientId, previousStock: ingredient.currentStock, currentStock: stock, receivedAt, source: 'Module 18' },
      ...signals,
    ]);

    const changes: Module9AvailabilityEvent[] = [];
    for (const item of this.menuCatalog) {
      const oldStatus = before.get(item.id)!;
      const newStatus = this.evaluateItem(item, nextIngredients);
      if (oldStatus.isAvailable === newStatus.isAvailable) continue;
      changes.push({
        id: 'AVL-' + receivedAt.getTime() + '-' + item.id,
        menuItemId: item.id,
        menuItemName: item.name,
        ingredientId,
        ingredientName: ingredient.name,
        eventType: newStatus.isAvailable ? 'restored' : 'suppressed',
        previousStock: ingredient.currentStock,
        currentStock: stock,
        eventTime: receivedAt,
        stockSignalId: signalId,
      });
    }
    if (changes.length) this.availabilityEventState.update((events) => [...changes, ...events]);
  }

  ingredientFor(id: string): Module9Ingredient | undefined {
    return this.ingredientStock().find((ingredient) => ingredient.id === id);
  }

  dependentDishNames(ingredientId: string): string[] {
    return this.menuCatalog
      .filter((item) => item.recipe.some((part) => part.ingredientId === ingredientId))
      .map((item) => item.name);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
