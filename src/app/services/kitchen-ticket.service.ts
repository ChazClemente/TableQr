import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  KitchenTicket,
  KitchenTicketItem,
  TicketCategory,
  TicketSource,
  TicketStage,
} from '../core/models/ticket.model';
import { SupabaseService } from '../store/supabase.service';

type TicketBase = Omit<KitchenTicket, 'fireInSeconds'>;

const DEFAULT_BENCHMARK_MINUTES = 25;

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const toUiStage = (dbStage: string): TicketStage =>
  dbStage === 'ready' ? 'Ready' : dbStage === 'served' ? 'Served' : 'Preparing';

const toDbStage: Record<TicketStage, string> = {
  Preparing: 'preparing',
  Ready: 'ready',
  Served: 'served',
};

@Injectable({ providedIn: 'root' })
export class KitchenTicketService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly db = inject(SupabaseService).client;

  private readonly ticketsState = signal<TicketBase[]>([]);
  private readonly nowMs = signal(Date.now());
  private reloadTimer: number | undefined;

  readonly tickets = computed<KitchenTicket[]>(() => {
    const now = this.nowMs();
    return [...this.ticketsState()]
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .map((ticket) => ({
        ...ticket,
        fireInSeconds:
          ticket.stage === 'Preparing'
            ? Math.max(
                0,
                Math.floor((ticket.submittedAt.getTime() + ticket.benchmarkMinutes * 60_000 - now) / 1000),
              )
            : 0,
      }));
  });

  readonly counts = computed(() => {
    const tickets = this.ticketsState();
    return {
      all: tickets.length,
      Preparing: tickets.filter((t) => t.stage === 'Preparing').length,
      Ready: tickets.filter((t) => t.stage === 'Ready').length,
      Served: tickets.filter((t) => t.stage === 'Served').length,
    };
  });

  constructor() {
    const clock = window.setInterval(() => this.nowMs.set(Date.now()), 1000);

    const channel = this.db.channel('kds-live');
    for (const table of ['ticket', 'ticket_item', 'stage_transition']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        this.scheduleReload(),
      );
    }
    channel.subscribe();

    this.destroyRef.onDestroy(() => {
      window.clearInterval(clock);
      window.clearTimeout(this.reloadTimer);
      this.db.removeChannel(channel);
    });

    void this.load();
  }

  private scheduleReload(): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.load(), 300);
  }

  private async load(): Promise<void> {
    const since = new Date(Date.now() - 12 * 3_600_000).toISOString();

    const [benchmarks, tickets] = await Promise.all([
      this.db.from('category_benchmark').select('category_name, benchmark_max_minutes'),
      this.db
        .from('ticket')
        .select(
          `ticket_id, submission_timestamp, current_stage,
           orders ( order_type, tables ( table_number ) ),
           ticket_item ( quantity, menu ( menu_name, menu_category ) ),
           stage_transition ( changed_at )`,
        )
        .gte('submission_timestamp', since),
    ]);

    if (tickets.error) {
      console.error('KDS load failed', tickets.error);
      return;
    }

    const benchmarkByCategory = new Map<string, number>(
      (benchmarks.data ?? []).map((b: any) => [b.category_name, b.benchmark_max_minutes]),
    );

    const mapped: TicketBase[] = (tickets.data ?? []).map((row: any) => {
      const order = one<any>(row.orders);
      const table = one<any>(order?.tables);
      const submittedAt = new Date(row.submission_timestamp);

      const items: KitchenTicketItem[] = [];
      let benchmark = 0;
      for (const ti of row.ticket_item ?? []) {
        const menu = one<any>(ti.menu);
        const category: string = menu?.menu_category ?? '';
        benchmark = Math.max(benchmark, benchmarkByCategory.get(category) ?? 0);
        items.push({
          name: menu?.menu_name ?? 'Unknown item',
          quantity: ti.quantity,
          category: category.toUpperCase() as TicketCategory,
        });
      }

      const changes: number[] = (row.stage_transition ?? []).map((s: any) =>
        new Date(s.changed_at).getTime(),
      );
      const stageChangedAt = new Date(Math.max(submittedAt.getTime(), ...changes));

      const source: TicketSource = /pos|counter|walk|take/i.test(order?.order_type ?? '')
        ? 'POS'
        : 'QR';

      return {
        id: `TKT-${String(row.ticket_id).padStart(3, '0')}`,
        source,
        location: table?.table_number ? `Table ${table.table_number}` : 'Counter',
        submittedAt,
        stage: toUiStage(row.current_stage),
        stageChangedAt,
        benchmarkMinutes: benchmark || DEFAULT_BENCHMARK_MINUTES,
        items,
      };
    });

    this.ticketsState.set(mapped);
  }

  async advanceStage(ticketId: string): Promise<void> {
    const ticket = this.ticketsState().find((t) => t.id === ticketId);
    if (!ticket || ticket.stage === 'Served') return;

    const next: TicketStage = ticket.stage === 'Preparing' ? 'Ready' : 'Served';
    const dbId = Number(ticketId.replace('TKT-', ''));
    const changedAt = new Date();

    // Update the screen immediately, then save.
    this.ticketsState.update((list) =>
      list.map((t) => (t.id === ticketId ? { ...t, stage: next, stageChangedAt: changedAt } : t)),
    );

    const [update, log] = await Promise.all([
      this.db.from('ticket').update({ current_stage: toDbStage[next] }).eq('ticket_id', dbId),
      this.db
        .from('stage_transition')
        .insert({ ticket_id: dbId, stage: toDbStage[next], changed_at: changedAt.toISOString() }),
    ]);

    if (update.error || log.error) {
      console.error('Stage update failed', update.error ?? log.error);
      void this.load(); // put the screen back in line with the database
    }
  }

  elapsedMinutes(ticket: KitchenTicket): number {
    return Math.max(0, Math.floor((this.nowMs() - ticket.submittedAt.getTime()) / 60_000));
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