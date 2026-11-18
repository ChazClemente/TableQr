import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Module7ActiveTicket, Module7FireRecommendation } from '../../../core/models/module7-ticket.model';
import { Module7TicketService } from '../../../services/module7-ticket.service';

@Component({
  selector: 'app-fire-time-advisor',
  imports: [CommonModule],
  templateUrl: './fire-time-advisor.html',
  styleUrl: './fire-time-advisor.css',
})
export class FireTimeAdvisor {
  readonly ticketService = inject(Module7TicketService);
  readonly clock = signal(new Date());
  readonly selectedTicket = this.ticketService.selectedTicket;
  readonly activeTickets = computed(() =>
  [...this.ticketService.activeTickets()].sort(
    (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime() // newest first; use a - b for oldest first
  )
);
  readonly recommendations = this.ticketService.recommendations;
  readonly summary = this.ticketService.summary;
  readonly complianceLog = this.ticketService.complianceLog;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const clockTimer = window.setInterval(() => this.clock.set(new Date()), 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(clockTimer));
  }

  selectTicket(ticketId: string): void {
    this.ticketService.selectTicket(ticketId);
  }

  recalculate(): void {
    this.ticketService.recalculate();
  }

  recordStart(item: Module7FireRecommendation): void {
    void this.ticketService.recordStart(item);
  }

  /** Rank of the next item that has not been started (for the "next-up" highlight). */
  nextRank(): number | null {
    return this.recommendations().find((r) => !r.actualStartAt)?.rank ?? null;
  }

  elapsedMinutes(ticket: Module7ActiveTicket): number {
    return Math.max(0, Math.floor((this.clock().getTime() - ticket.receivedAt.getTime()) / 60_000));
  }
    /** 3 min ago / 1 hr 37 min ago / 4 days 11 hrs ago */
  elapsedLabel(ticket: Module7ActiveTicket): string {
    const m = this.elapsedMinutes(ticket);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) {
      const rm = m % 60;
      return rm ? `${h} hr ${rm} min ago` : `${h} hr ago`;
    }
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh ? `${d} ${d === 1 ? 'day' : 'days'} ${rh} hr ago` : `${d} ${d === 1 ? 'day' : 'days'} ago`;
  }

  formatTime(date: Date): string {
    return this.ticketService.formatTime(date);
  }
}