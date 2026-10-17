import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Module9AvailabilityService } from '../../../services/module9-availability.service';

type CategoryFilter = string;

@Component({
  selector: 'app-stock-control',
  imports: [CommonModule],
  templateUrl: './stock-control.html',
  styleUrl: './stock-control.css',
})
export class StockControl {
  readonly availability = inject(Module9AvailabilityService);
  readonly categoryFilter = signal<CategoryFilter>('All');
  readonly searchQuery = signal('');
  readonly selectedIngredientId = signal('pork');
  readonly newStockValue = signal(2);
  readonly ingredients = this.availability.ingredients;
  readonly summary = this.availability.summary;
  readonly stockSignals = this.availability.stockSignals;
  readonly availabilityEvents = this.availability.availabilityEvents;
  readonly menuStatuses = this.availability.menuStatuses;
  readonly categoryOptions = computed(() => ['All', ...new Set(this.menuStatuses().map((item) => item.category))]);
  readonly visibleDishes = computed(() => {
    const category = this.categoryFilter();
    const query = this.searchQuery().trim().toLocaleLowerCase();
    return this.menuStatuses().filter((item) =>
      (category === 'All' || item.category === category)
      && (!query || item.name.toLocaleLowerCase().includes(query)),
    );
  });

  setCategory(category: CategoryFilter): void {
    this.categoryFilter.set(category);
  }

  setSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      All: '\u{1F37D}',
      PAMPAGANA: '\u{1F957}',
      SABAW: '\u{1F372}',
      ULAM: '\u{1F356}',
      'KANIN & PANSIT': '\u{1F35A}',
      MERIENDA: '\u{1F96E}',
      INUMIN: '\u{1F964}',
    };
    return icons[category] ?? '\u{1F37D}';
  }

  setIngredient(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedIngredientId.set(id);
    const ingredient = this.availability.ingredientFor(id);
    if (ingredient) this.newStockValue.set(ingredient.currentStock);
  }

  setNewStockValue(event: Event): void {
    this.newStockValue.set(Number((event.target as HTMLInputElement).value));
  }

  submitStockSignal(): void {
    this.availability.receiveStockSignal(this.selectedIngredientId(), this.newStockValue());
  }

  formatTime(date: Date): string {
    return this.availability.formatTime(date);
  }
}
