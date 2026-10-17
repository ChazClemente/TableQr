import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  Module7ActiveTicket,
  Module7CategoryBenchmark,
  Module7ComplianceLog,
  Module7FireRecommendation,
} from '../core/models/module7-ticket.model';

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

@Injectable({ providedIn: 'root' })
export class Module7TicketService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly timeState = signal(Date.now());
  private readonly selectedTicketIdState = signal('TKT-204');
  private readonly stationLoadState = signal(2);
  private readonly recalculationCountState = signal(1);
  private readonly lastCalculatedState = signal(new Date());
  private readonly startedItemsState = signal<Record<string, { actualStartAt: Date; followed: boolean }>>({});
  private readonly complianceLogState = signal<Module7ComplianceLog[]>([]);

  readonly benchmarks: Module7CategoryBenchmark[] = [
    { category: 'SABAW', prepMinutes: 25 },
    { category: 'ULAM', prepMinutes: 18 },
    { category: 'KANIN & PANSIT', prepMinutes: 12 },
    { category: 'PAMPAGANA', prepMinutes: 10 },
    { category: 'INUMIN', prepMinutes: 5 },
    { category: 'MERIENDA', prepMinutes: 8 },
  ];

  private readonly activeTicketsState = signal<Module7ActiveTicket[]>([
    {
      id: 'TKT-204', location: 'Table 08', receivedAt: minutesAgo(3), targetServeAt: minutesFromNow(24),
      items: [
        { id: '204-1', name: 'Bulalo Batangas', category: 'SABAW', quantity: 1 },
        { id: '204-2', name: 'Adobong Puti', category: 'ULAM', quantity: 2 },
        { id: '204-3', name: 'Sinangag at Itlog', category: 'KANIN & PANSIT', quantity: 2 },
        { id: '204-4', name: 'Buko Juice', category: 'INUMIN', quantity: 2 },
      ],
    },
    {
      id: 'TKT-205', location: 'Table 03', receivedAt: minutesAgo(1), targetServeAt: minutesFromNow(31),
      items: [
        { id: '205-1', name: 'Sinigang na Bangus', category: 'SABAW', quantity: 1 },
        { id: '205-2', name: 'Pinakbet Ilocos', category: 'ULAM', quantity: 1 },
        { id: '205-3', name: 'Pansit Bihon Guisado', category: 'KANIN & PANSIT', quantity: 1 },
        { id: '205-4', name: 'Halo-Halo', category: 'MERIENDA', quantity: 2 },
      ],
    },
  ]);

  readonly activeTickets = computed(() =>
    [...this.activeTicketsState()].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()),
  );
  readonly selectedTicket = computed(
    () => this.activeTickets().find((ticket) => ticket.id === this.selectedTicketIdState()) ?? this.activeTickets()[0],
  );
  readonly stationLoad = this.stationLoadState.asReadonly();
  readonly recalculationCount = this.recalculationCountState.asReadonly();
  readonly lastCalculated = this.lastCalculatedState.asReadonly();
  readonly complianceLog = computed(() =>
    [...this.complianceLogState()].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()),
  );
  readonly recommendations = computed<Module7FireRecommendation[]>(() => {
    this.timeState();
    this.stationLoadState();
    this.recalculationCountState();
    const ticket = this.selectedTicket();
    if (!ticket) return [];
    const ranked = ticket.items
      .map((item) => {
        const prepMinutes = this.benchmarks.find((benchmark) => benchmark.category === item.category)?.prepMinutes ?? 15;
        const key = ticket.id + ':' + item.id;
        const started = this.startedItemsState()[key];
        return {
          ticketId: ticket.id,
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          quantity: item.quantity,
          prepMinutes,
          targetServeAt: ticket.targetServeAt,
          recommendedStartAt: new Date(ticket.targetServeAt.getTime() - prepMinutes * 60_000),
          actualStartAt: started?.actualStartAt,
          followed: started?.followed,
        };
      })
      .sort((a, b) => a.recommendedStartAt.getTime() - b.recommendedStartAt.getTime());
    return ranked.map((item, index) => ({ ...item, rank: index + 1 }));
  });
  readonly summary = computed(() => {
    const recommendations = this.recommendations();
    const logs = this.complianceLog();
    const followed = logs.filter((entry) => entry.followed).length;
    return {
      activeTickets: this.activeTickets().length,
      recommendedItems: recommendations.length,
      startedItems: recommendations.filter((entry) => entry.actualStartAt).length,
      adoptionRate: logs.length ? Math.round((followed / logs.length) * 100) : null,
    };
  });

  constructor() {
    const timer = window.setInterval(() => this.timeState.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }

  selectTicket(ticketId: string): void {
    this.selectedTicketIdState.set(ticketId);
    this.recalculate();
  }

  setStationLoad(value: number): void {
    this.stationLoadState.set(Math.max(0, Math.floor(value || 0)));
    this.recalculate();
  }

  addDemoTicket(): void {
    const sequence = 206 + this.activeTicketsState().length - 2;
    const id = 'TKT-' + sequence;
    const ticket: Module7ActiveTicket = {
      id,
      location: 'Table 0' + ((sequence % 8) + 1),
      receivedAt: new Date(),
      targetServeAt: minutesFromNow(27),
      items: [
        { id: sequence + '-1', name: 'Sinigang na Bangus', category: 'SABAW', quantity: 1 },
        { id: sequence + '-2', name: 'Pansit Bihon Guisado', category: 'KANIN & PANSIT', quantity: 1 },
        { id: sequence + '-3', name: 'Buko Juice', category: 'INUMIN', quantity: 2 },
      ],
    };
    this.activeTicketsState.update((tickets) => [...tickets, ticket]);
    this.selectedTicketIdState.set(id);
    this.recalculate();
  }

  recalculate(): void {
    this.recalculationCountState.update((count) => count + 1);
    this.lastCalculatedState.set(new Date());
  }

  recordStart(recommendation: Module7FireRecommendation, followed: boolean): void {
    const actualStartAt = new Date();
    const key = recommendation.ticketId + ':' + recommendation.itemId;
    if (this.startedItemsState()[key]) return;
    this.startedItemsState.update((items) => ({ ...items, [key]: { actualStartAt, followed } }));
    this.complianceLogState.update((entries) => [
      {
        id: key + ':' + actualStartAt.getTime(),
        ticketId: recommendation.ticketId,
        itemName: recommendation.itemName,
        recommendedStartAt: recommendation.recommendedStartAt,
        actualStartAt,
        followed,
        recordedAt: actualStartAt,
      },
      ...entries,
    ]);
  }

  remainingLabel(startAt: Date): string {
    const seconds = Math.floor((startAt.getTime() - this.timeState()) / 1000);
    if (seconds <= 0) return 'Start next';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return 'In ' + minutes + ':' + String(remainingSeconds).padStart(2, '0');
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }
}
