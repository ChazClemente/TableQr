import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Module10AnalyticsService } from '../../../services/module10-analytics.service';

@Component({
  imports: [CommonModule],
  selector: 'app-workload',
  styleUrl: './workload.css',
  templateUrl: './workload.html',
})
export class Workload {
  readonly analytics = inject(Module10AnalyticsService);
  readonly clock = signal(new Date());
  readonly hourlyVolumes = computed(() => this.analytics.hourlyVolumes(this.clock(), 24));
  readonly busiestHour = computed(() => this.hourlyVolumes().reduce((busiest, hour) => hour.orderCount > busiest.orderCount ? hour : busiest));
  readonly maximumVolume = computed(() => Math.max(1, ...this.hourlyVolumes().map((hour) => hour.orderCount)));
  readonly finalizedOrders = computed(() => this.hourlyVolumes().filter((hour) => hour.finalized).reduce((sum, hour) => sum + hour.orderCount, 0));
  readonly peakHours = computed(() => this.hourlyVolumes().filter((hour) => hour.finalized && hour.isPeak).length);
  readonly ordersToday = computed(() => this.analytics.orderEvents().filter((event) => event.occurredAt.toDateString() === this.clock().toDateString()).length);
  readonly historicalHours = computed(() => this.hourlyVolumes().filter((hour) => hour.finalized).slice(-6).reverse());

  get estimates() { return this.analytics.estimates; }

  private readonly destroyRef = inject(DestroyRef);

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
      PAMPAGANA: '\u{1F957}', SABAW: '\u{1F372}', ULAM: '\u{1F356}',
      'KANIN & PANSIT': '\u{1F35A}', MERIENDA: '\u{1F96E}', INUMIN: '\u{1F964}',
    };
    return icons[category] ?? '\u{1F37D}';
  }

  titleCategory(category: string): string {
    return category === 'KANIN & PANSIT'
      ? 'Kanin & Pansit'
      : category.charAt(0) + category.slice(1).toLocaleLowerCase();
  }
}