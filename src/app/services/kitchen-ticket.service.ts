import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { KitchenTicket, TicketStage } from '../core/models/ticket.model';

const now = () => new Date();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

@Injectable({ providedIn: 'root' })
export class KitchenTicketService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ticketsState = signal<KitchenTicket[]>([
    {
      id: 'TKT-001',
      source: 'QR',
      location: 'Table 2',
      submittedAt: minutesAgo(19),
      stage: 'Preparing',
      stageChangedAt: minutesAgo(19),
      benchmarkMinutes: 25,
      fireInSeconds: 18 * 60 + 10,
      items: [
        { name: 'Bulalo Batangas', quantity: 1, category: 'SABAW' },
        { name: 'Adobong Puti', quantity: 2, category: 'ULAM' },
        { name: 'Sinangag at Itlog', quantity: 2, category: 'KANIN & PANSIT' },
      ],
    },
    {
      id: 'TKT-002',
      source: 'POS',
      location: 'Counter #1',
      submittedAt: minutesAgo(13),
      stage: 'Ready',
      stageChangedAt: minutesAgo(1),
      benchmarkMinutes: 12,
      fireInSeconds: 12 * 60 + 10,
      items: [
        { name: 'Pansit Bihon Guisado', quantity: 1, category: 'KANIN & PANSIT' },
        { name: 'Bagnet Chicharon', quantity: 1, category: 'PAMPAGANA' },
        { name: 'Salabat', quantity: 2, category: 'INUMIN' },
      ],
    },
    {
      id: 'TKT-003',
      source: 'QR',
      location: 'Table 5',
      submittedAt: minutesAgo(7),
      stage: 'Preparing',
      stageChangedAt: minutesAgo(7),
      benchmarkMinutes: 25,
      fireInSeconds: 6 * 60 + 10,
      items: [
        { name: 'Sinigang na Bangus', quantity: 1, category: 'SABAW' },
        { name: 'Pinakbet Ilocos', quantity: 1, category: 'ULAM' },
        { name: 'Halo-Halo', quantity: 2, category: 'MERIENDA' },
        { name: 'Buko Juice', quantity: 2, category: 'INUMIN' },
      ],
    },
    {
      id: 'TKT-004',
      source: 'POS',
      location: 'Counter #2',
      submittedAt: minutesAgo(3),
      stage: 'Preparing',
      stageChangedAt: minutesAgo(3),
      benchmarkMinutes: 25,
      fireInSeconds: 2 * 60 + 10,
      items: [
        { name: 'Kare-Kare', quantity: 1, category: 'ULAM' },
        { name: 'Empanada Vigan', quantity: 2, category: 'PAMPAGANA' },
        { name: "Sago't Gulaman", quantity: 2, category: 'INUMIN' },
      ],
    },
  ]);

  readonly tickets = computed(() =>
    [...this.ticketsState()].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()),
  );

  readonly counts = computed(() => {
    const tickets = this.ticketsState();
    return {
      all: tickets.length,
      Preparing: tickets.filter((ticket) => ticket.stage === 'Preparing').length,
      Ready: tickets.filter((ticket) => ticket.stage === 'Ready').length,
      Served: tickets.filter((ticket) => ticket.stage === 'Served').length,
    };
  });

  constructor() {
    const countdownInterval = window.setInterval(() => {
      this.ticketsState.update((tickets) =>
        tickets.map((ticket) =>
          ticket.stage === 'Preparing' && ticket.fireInSeconds > 0
            ? { ...ticket, fireInSeconds: ticket.fireInSeconds - 1 }
            : ticket,
        ),
      );
    }, 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(countdownInterval));
  }

  advanceStage(ticketId: string): void {
    const next: Record<TicketStage, TicketStage> = {
      Preparing: 'Ready',
      Ready: 'Served',
      Served: 'Served',
    };
    this.ticketsState.update((tickets) =>
      tickets.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, stage: next[ticket.stage], stageChangedAt: now() }
          : ticket,
      ),
    );
  }

  elapsedMinutes(ticket: KitchenTicket): number {
    return Math.max(0, Math.floor((Date.now() - ticket.submittedAt.getTime()) / 60_000));
  }

  progressPercent(ticket: KitchenTicket): number {
    return Math.min(100, (this.elapsedMinutes(ticket) / ticket.benchmarkMinutes) * 100);
  }

  isOverBenchmark(ticket: KitchenTicket): boolean {
    return this.elapsedMinutes(ticket) >= ticket.benchmarkMinutes;
  }

  formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  formatClockTime(date: Date): string {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }
}