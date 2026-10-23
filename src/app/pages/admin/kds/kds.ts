import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { categories, MenuCategory } from '../../../core/models/menu.model';
import { KitchenTicket, TicketCategory, TicketStage } from '../../../core/models/ticket.model';
import { KitchenTicketService } from '../../../services/kitchen-ticket.service';

const ticketCategoryByMenuCategory: Record<MenuCategory, TicketCategory> = {
  Pampagana: 'PAMPAGANA',
  Sabaw: 'SABAW',
  Ulam: 'ULAM',
  'Kanin & Pansit': 'KANIN & PANSIT',
  Merienda: 'MERIENDA',
  Inumin: 'INUMIN',
};

const categoryIcons: Record<MenuCategory, string> = {
  Pampagana: '\u{1F957}',
  Sabaw: '\u{1F372}',
  Ulam: '\u{1F356}',
  'Kanin & Pansit': '\u{1F35A}',
  Merienda: '\u{1F96E}',
  Inumin: '\u{1F964}',
};

@Component({
  imports: [CommonModule],
  selector: 'app-kds',
  styleUrl: './kds.css',
  templateUrl: './kds.html',
})
export class Kds {
  readonly ticketService = inject(KitchenTicketService);
  readonly filters = ['All', 'Preparing', 'Ready', 'Served'] as const;
  readonly activeFilter = signal<(typeof this.filters)[number]>('All');
  readonly categories = categories;
  readonly activeCategory = signal<MenuCategory | null>(null);
  readonly categoryFilterOpen = signal(false);
  readonly clock = signal(new Date());
  readonly counts = this.ticketService.counts;
  readonly visibleTickets = computed(() => {
    const filter = this.activeFilter();
    const category = this.activeCategory();
    const tickets = this.ticketService.tickets();
    return tickets.filter((ticket) =>
      (filter === 'All' || ticket.stage === filter)
      && (!category || ticket.items.some((item) => item.category === ticketCategoryByMenuCategory[category])),
    );
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const clockInterval = window.setInterval(() => this.clock.set(new Date()), 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(clockInterval));
  }

  setFilter(filter: (typeof this.filters)[number]): void {
    this.activeFilter.set(filter);
  }

  toggleCategoryFilter(): void {
    this.categoryFilterOpen.update((isOpen) => !isOpen);
  }

  setCategoryFilter(category: MenuCategory | null): void {
    this.activeCategory.set(category);
    this.categoryFilterOpen.set(false);
  }

  menuCategoryIcon(category: MenuCategory): string {
    return categoryIcons[category];
  }

  categoryIcon(category: TicketCategory): string {
    const menuCategory = this.categories.find(
      (candidate) => ticketCategoryByMenuCategory[candidate] === category,
    );
    return menuCategory ? categoryIcons[menuCategory] : '';
  }

  groupedItems(ticket: KitchenTicket): { category: TicketCategory; items: KitchenTicket['items'] }[] {
    const activeCategory = this.activeCategory();
    const groups = new Map<TicketCategory, KitchenTicket['items']>();
    for (const item of ticket.items) {
      if (activeCategory && item.category !== ticketCategoryByMenuCategory[activeCategory]) continue;
      const items = groups.get(item.category) ?? [];
      items.push(item);
      groups.set(item.category, items);
    }
    return Array.from(groups, ([category, items]) => ({ category, items }));
  }

  trackByTicketId(_index: number, ticket: KitchenTicket): string {
    return ticket.id;
  }

  onAdvance(ticket: KitchenTicket): void {
    this.ticketService.advanceStage(ticket.id);
  }

  actionLabel(stage: TicketStage): string {
    if (stage === 'Preparing') return 'Mark Ready';
    if (stage === 'Ready') return 'Mark Served';
    return 'Served';
  }
}
