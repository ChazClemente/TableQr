import { effect, Injectable, inject, signal } from '@angular/core';
import { KitchenTicketService } from './kitchen-ticket.service';
import { Module10CategoryEstimate, Module10HourlyVolume, Module10OrderTimestampEvent } from '../core/models/module10.model';

const STORAGE_KEY = 'kainan-module10-order-events-v1';
const PEAK_HOUR_THRESHOLD = 10;
const HOUR_MS = 60 * 60 * 1000;

const categoryEstimates: Module10CategoryEstimate[] = [
  { category: 'SABAW', prepMinutes: 25 },
  { category: 'ULAM', prepMinutes: 18 },
  { category: 'KANIN & PANSIT', prepMinutes: 12 },
  { category: 'PAMPAGANA', prepMinutes: 10 },
  { category: 'INUMIN', prepMinutes: 5 },
  { category: 'MERIENDA', prepMinutes: 8 },
];

@Injectable({ providedIn: 'root' })
export class Module10AnalyticsService {
  private readonly kitchenTickets = inject(KitchenTicketService);
  readonly peakThreshold = PEAK_HOUR_THRESHOLD;
  readonly estimates = categoryEstimates;
  private readonly orderEventsState = signal(this.readStoredEvents());
  readonly orderEvents = this.orderEventsState.asReadonly();

  constructor() {
    effect(() => {
      const knownIds = new Set(this.orderEventsState().map((event) => event.orderId));
      const newEvents = this.kitchenTickets.tickets()
        .filter((ticket) => !knownIds.has(ticket.id))
        .map((ticket) => ({ orderId: ticket.id, occurredAt: ticket.submittedAt, source: 'Module 6' as const }));
      if (!newEvents.length) return;
      this.orderEventsState.update((events) => [...events, ...newEvents].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()));
      this.persistEvents();
    });
  }

  hourlyVolumes(now: Date, numberOfHours = 24): Module10HourlyVolume[] {
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    const start = currentHour.getTime() - (numberOfHours - 1) * HOUR_MS;
    const counts = new Map<number, number>();
    for (const event of this.orderEventsState()) {
      const hourStart = new Date(event.occurredAt);
      hourStart.setMinutes(0, 0, 0);
      const hour = hourStart.getTime();
      if (hour >= start && hour <= currentHour.getTime()) counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }
    return Array.from({ length: numberOfHours }, (_, index) => {
      const hour = start + index * HOUR_MS;
      const orderCount = counts.get(hour) ?? 0;
      return {
        hourStart: new Date(hour),
        orderCount,
        finalized: hour < currentHour.getTime(),
        isPeak: orderCount > this.peakThreshold,
      };
    });
  }

  private readStoredEvents(): Module10OrderTimestampEvent[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { orderId: string; occurredAt: string; source: Module10OrderTimestampEvent['source'] }[];
        return parsed.map((event) => ({ ...event, occurredAt: new Date(event.occurredAt) }));
      }
    } catch {
      // Use the document's sample dashboard history if browser storage is unavailable.
    }
    const sampleHourlyCounts = [2, 3, 4, 2, 3, 5, 7, 11, 13, 9, 6, 4, 3, 5, 8, 12, 14, 10, 7, 5, 4, 6, 8];
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    return sampleHourlyCounts.flatMap((count, hourIndex) => {
      const hourStart = currentHour.getTime() - (sampleHourlyCounts.length - hourIndex) * HOUR_MS;
      return Array.from({ length: count }, (_, orderIndex) => ({
        orderId: `SAMPLE-${hourIndex + 1}-${orderIndex + 1}`,
        occurredAt: new Date(hourStart + (orderIndex + 1) * Math.floor(HOUR_MS / (count + 1))),
        source: 'Sample history' as const,
      }));
    });
  }

  private persistEvents(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.orderEventsState()));
    } catch {
      // The current session still keeps its timestamp events in memory.
    }
  }
}
