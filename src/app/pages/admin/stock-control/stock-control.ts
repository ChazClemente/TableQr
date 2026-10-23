import { Component, computed, inject, signal } from '@angular/core';
import { Module9AvailabilityService } from '../../../services/module9-availability.service';

@Component({
  selector: 'app-stock-control',
  imports: [],
  templateUrl: './stock-control.html',
  styleUrl: './stock-control.css',
})
export class StockControl {
  readonly availability = inject(Module9AvailabilityService);
  readonly categoryFilter = signal<string>('All');
  readonly searchQuery = signal('');
  readonly newStockValue = signal(2);
  private readonly pickedIngredientId = signal<number | null>(null);

  readonly ingredients = this.availability.ingredients;
  readonly summary = this.availability.summary;
  readonly stockSignals = this.availability.stockSignals;
  readonly availabilityEvents = this.availability.availabilityEvents;
  readonly menuStatuses = this.availability.menuStatuses;

  readonly selectedIngredientId = computed(() => this.pickedIngredientId() ?? this.ingredients()[0]?.id ?? null);
  readonly categoryOptions = computed(() => ['All', ...new Set(this.menuStatuses().map((i) => i.category))]);
  readonly visibleDishes = computed(() => {
    const category = this.categoryFilter();
    const query = this.searchQuery().trim().toLocaleLowerCase();
    return this.menuStatuses().filter((item) =>
      (category === 'All' || item.category === category)
      && (!query || item.name.toLocaleLowerCase().includes(query)),
    );
  });

  setCategory(category: string): void {
    this.categoryFilter.set(category);
  }

  setSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      All: '\u{1F37D}', PAMPAGANA: '\u{1F957}', SABAW: '\u{1F372}', ULAM: '\u{1F356}',
      'KANIN & PANSIT': '\u{1F35A}', MERIENDA: '\u{1F96E}', INUMIN: '\u{1F964}',
    };
    return icons[category] ?? '\u{1F37D}';
  }

  setIngredient(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    this.pickedIngredientId.set(id);
    const ingredient = this.availability.ingredientFor(id);
    if (ingredient) this.newStockValue.set(ingredient.currentStock);
  }

  setNewStockValue(event: Event): void {
    this.newStockValue.set(Number((event.target as HTMLInputElement).value));
  }

  submitStockSignal(): void {
    const id = this.selectedIngredientId();
    if (id !== null) this.availability.receiveStockSignal(id, this.newStockValue());
  }

  formatTime(date: Date): string {
    return this.availability.formatTime(date);
  }
}