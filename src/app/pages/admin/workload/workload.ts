import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { CATEGORY_PREP, KitchenStore } from '../../../store/kitchen-store';

interface HourlyVolume {
  hourStart: Date;
  orderCount: number;
  finalized: boolean;
  isPeak: boolean;
}

@Component({
  imports: [CommonModule],
  selector: 'app-workload',
  styleUrl: './workload.css',
  templateUrl: './workload.html',
})
export class Workload {
  private readonly kitchen = inject(KitchenStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly peakThreshold = 10;
  readonly clock = signal(new Date());

  // Huling 12 oras; ang pinakahuli ang kasalukuyang oras (hindi pa finalized)
  readonly hourlyVolumes = computed<HourlyVolume[]>(() => {
  const raw = this.kitchen.hourlyCounts();
  const counts = [...Array(Math.max(0, 24 - raw.length)).fill(0), ...raw.slice(-24)];
  const current = new Date(this.clock());
  current.setMinutes(0, 0, 0);
  return counts.map((orderCount, i) => {
    const offset = counts.length - 1 - i;
    return {
      hourStart: new Date(current.getTime() - offset * 3_600_000),
      orderCount,
      finalized: offset > 0,
      isPeak: orderCount > this.peakThreshold,
    };
  });
});

  readonly busiestHour = computed(() =>
    this.hourlyVolumes().reduce((b, h) => (h.orderCount > b.orderCount ? h : b)),
  );
  readonly maximumVolume = computed(() => Math.max(1, ...this.hourlyVolumes().map(h => h.orderCount)));
  readonly finalizedOrders = computed(() =>
    this.hourlyVolumes().filter(h => h.finalized).reduce((s, h) => s + h.orderCount, 0),
  );
  readonly peakHours = computed(() => this.hourlyVolumes().filter(h => h.finalized && h.isPeak).length);
  readonly ordersToday = computed(() =>
    this.kitchen.tickets().filter(t => t.receivedAt.toDateString() === this.clock().toDateString()).length,
  );
  readonly historicalHours = computed(() => this.hourlyVolumes().filter(h => h.finalized).slice(-6).reverse());

  readonly estimates = Object.entries(CATEGORY_PREP).map(([category, v]) => ({
    category,
    minMinutes: v.min,
    maxMinutes: v.max,
  }));

  constructor() {
    const refreshId = window.setInterval(() => this.clock.set(new Date()), 30_000);
    this.destroyRef.onDestroy(() => window.clearInterval(refreshId));
  }

  barHeight(orderCount: number): number {
    return Math.max(orderCount ? 5 : 0, Math.round((orderCount / this.maximumVolume()) * 100));
  }

  formatHour(date: Date): string {
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', hour12: true });
  }

  categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Soup': '\u{1F372}', 'Dry Dishes': '\u{1F356}', 'Pulutan': '\u{1F37A}',
      'Sizzling': '\u{1F525}', 'Noodles': '\u{1F35C}', 'Pancit sa Bilao': '\u{1F35D}',
      'Sandwiches': '\u{1F96A}', 'Panghimagas': '\u{1F36E}', 'Beverages': '\u{1F964}',
      'Rice': '\u{1F35A}', 'Native Dishes': '\u{1F958}', 'Dishes': '\u{1F37D}',
      'Toppings': '\u{1F9C0}', 'Specialties': '\u{2B50}', 'Fish': '\u{1F41F}',
      'Desserts': '\u{1F368}',
    };
    return icons[category] ?? '\u{1F37D}';
  }

  titleCategory(category: string): string {
    return category;
  }
}