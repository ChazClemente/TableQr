import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
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
  readonly activeTickets = this.ticketService.activeTickets;
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

  simulateTicketArrival(): void {
    this.ticketService.addDemoTicket();
  }

  updateStationLoad(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.ticketService.setStationLoad(value);
  }

  recordStart(item: Module7FireRecommendation, followed: boolean): void {
    this.ticketService.recordStart(item, followed);
  }

  elapsedMinutes(ticket: Module7ActiveTicket): number {
    return Math.max(0, Math.floor((this.clock().getTime() - ticket.receivedAt.getTime()) / 60_000));
  }

  formatTime(date: Date): string {
    return this.ticketService.formatTime(date);
  }
}
