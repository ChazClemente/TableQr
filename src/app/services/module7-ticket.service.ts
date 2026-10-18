import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import {
  Module7ActiveTicket,
  Module7CategoryBenchmark,
  Module7ComplianceLog,
  Module7FireRecommendation,
} from '../core/models/module7-ticket.model';
import { SupabaseService } from '../store/supabase.service';

const DEFAULT_PREP_MINUTES = 15;
const FOLLOW_TOLERANCE_MINUTES = 2; // within 2 min of the advice counts as "followed"

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const ticketLabel = (id: number) => `TKT-${String(id).padStart(3, '0')}`;

@Injectable({ providedIn: 'root' })
export class Module7TicketService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly db = inject(SupabaseService).client;

  private readonly timeState = signal(Date.now());
  private readonly selectedTicketIdState = signal('');
  private readonly recalculationCountState = signal(1);
  private readonly lastCalculatedState = signal(new Date());
  private readonly startedItemsState = signal<Record<string, { actualStartAt: Date; followed: boolean }>>({});
  private readonly complianceLogState = signal<Module7ComplianceLog[]>([]);
  private readonly benchmarksState = signal<Module7CategoryBenchmark[]>([]);
  private readonly rawTicketsState = signal<Module7ActiveTicket[]>([]);
  private reloadTimer: number | undefined;

  get benchmarks(): Module7CategoryBenchmark[] {
    return this.benchmarksState();
  }

  /** Items already started, counted per active ticket. */
  private readonly cookingByTicket = computed(() => {
    const started = this.startedItemsState();
    const map = new Map<string, number>();
    for (const ticket of this.rawTicketsState()) {
      map.set(ticket.id, ticket.items.filter((i) => started[ticket.id + ':' + i.id]).length);
    }
    return map;
  });

  /** Automatic station load: every item currently cooking across all active tickets. */
  readonly stationLoad = computed(() => {
    let total = 0;
    for (const n of this.cookingByTicket().values()) total += n;
    return total;
  });

  /** Target serve time = received + slowest dish + items cooking for OTHER tickets (1 min each). */
  readonly activeTickets = computed<Module7ActiveTicket[]>(() => {
    const benchmarks = this.benchmarksState();
    const cooking = this.cookingByTicket();
    const total = this.stationLoad();
    return [...this.rawTicketsState()]
      .map((ticket) => {
        const longest = Math.max(
          0,
          ...ticket.items.map(
            (item) => benchmarks.find((b) => b.category === item.category)?.prepMinutes ?? DEFAULT_PREP_MINUTES,
          ),
        );
        const otherLoad = total - (cooking.get(ticket.id) ?? 0);
        return { ...ticket, targetServeAt: new Date(ticket.receivedAt.getTime() + (longest + otherLoad) * 60_000) };
      })
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  });

  readonly selectedTicket = computed(
    () => this.activeTickets().find((t) => t.id === this.selectedTicketIdState()) ?? this.activeTickets()[0],
  );
  readonly recalculationCount = this.recalculationCountState.asReadonly();
  readonly lastCalculated = this.lastCalculatedState.asReadonly();
  readonly complianceLog = computed(() =>
    [...this.complianceLogState()].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()),
  );

  readonly recommendations = computed<Module7FireRecommendation[]>(() => {
    this.timeState();
    const ticket = this.selectedTicket();
    if (!ticket) return [];
    const benchmarks = this.benchmarksState();
    const started = this.startedItemsState();

    const ranked = ticket.items
      .map((item) => {
        const prepMinutes =
          benchmarks.find((b) => b.category === item.category)?.prepMinutes ?? DEFAULT_PREP_MINUTES;
        const s = started[ticket.id + ':' + item.id];
        return {
          ticketId: ticket.id,
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          quantity: item.quantity,
          prepMinutes,
          targetServeAt: ticket.targetServeAt,
          recommendedStartAt: new Date(ticket.targetServeAt.getTime() - prepMinutes * 60_000),
          actualStartAt: s?.actualStartAt,
          followed: s?.followed,
        };
      })
      .sort((a, b) => a.recommendedStartAt.getTime() - b.recommendedStartAt.getTime());
    return ranked.map((item, index) => ({ ...item, rank: index + 1 }));
  });

  readonly summary = computed(() => {
    const recommendations = this.recommendations();
    const logs = this.complianceLog();
    const followed = logs.filter((e) => e.followed).length;
    return {
      activeTickets: this.activeTickets().length,
      recommendedItems: recommendations.length,
      startedItems: recommendations.filter((e) => e.actualStartAt).length,
      adoptionRate: logs.length ? Math.round((followed / logs.length) * 100) : null,
    };
  });

  constructor() {
    const timer = window.setInterval(() => this.timeState.set(Date.now()), 1000);

    const channel = this.db.channel('fire-time-live');
    for (const table of ['ticket', 'ticket_item', 'fire_time_recommendation']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.scheduleReload());
    }
    channel.subscribe();

    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
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
    const [bm, tk, fr] = await Promise.all([
      this.db.from('category_benchmark').select('category_name, benchmark_max_minutes'),
      this.db
        .from('ticket')
        .select(
          `ticket_id, submission_timestamp, current_stage,
           orders ( tables ( table_number ) ),
           ticket_item ( ticket_item_id, quantity, menu ( menu_name, menu_category ) )`,
        )
        .in('current_stage', ['pending', 'preparing']),
      this.db
        .from('fire_time_recommendation')
        .select(
          `recommendation_id, ticket_item_id, recommended_start_time, actual_start_time, followed,
           ticket_item ( ticket_id, menu ( menu_name ) )`,
        )
        .not('actual_start_time', 'is', null)
        .order('actual_start_time', { ascending: false })
        .limit(100),
    ]);

    if (tk.error) {
      console.error('Fire-time load failed', tk.error);
      return;
    }

    this.benchmarksState.set(
      (bm.data ?? []).map((b: any) => ({
        category: String(b.category_name).toUpperCase(),
        prepMinutes: b.benchmark_max_minutes,
      })),
    );

    this.rawTicketsState.set(
      (tk.data ?? []).map((row: any) => {
        const table = one<any>(one<any>(row.orders)?.tables);
        const receivedAt = new Date(row.submission_timestamp);
        return {
          id: ticketLabel(row.ticket_id),
          location: table?.table_number ? `Table ${table.table_number}` : 'Counter',
          receivedAt,
          targetServeAt: receivedAt, // recalculated in activeTickets
          items: (row.ticket_item ?? []).map((ti: any) => {
            const menu = one<any>(ti.menu);
            return {
              id: String(ti.ticket_item_id),
              name: menu?.menu_name ?? 'Unknown item',
              category: String(menu?.menu_category ?? '').toUpperCase(),
              quantity: ti.quantity,
            };
          }),
        };
      }),
    );

    const started: Record<string, { actualStartAt: Date; followed: boolean }> = {};
    const log: Module7ComplianceLog[] = [];
    for (const r of fr.data ?? []) {
      const ti = one<any>((r as any).ticket_item);
      if (!ti) continue;
      const ticketId = ticketLabel(ti.ticket_id);
      const actualStartAt = new Date((r as any).actual_start_time);
      started[ticketId + ':' + (r as any).ticket_item_id] = {
        actualStartAt,
        followed: !!(r as any).followed,
      };
      log.push({
        id: String((r as any).recommendation_id),
        ticketId,
        itemName: one<any>(ti.menu)?.menu_name ?? 'Unknown item',
        recommendedStartAt: new Date((r as any).recommended_start_time),
        actualStartAt,
        followed: !!(r as any).followed,
        recordedAt: actualStartAt,
      });
    }
    this.startedItemsState.set(started);
    this.complianceLogState.set(log);

    // automatic recalculation on every new ticket / change
    this.recalculationCountState.update((c) => c + 1);
    this.lastCalculatedState.set(new Date());
  }

  selectTicket(ticketId: string): void {
    this.selectedTicketIdState.set(ticketId);
  }

  /** One tap. The system decides "followed" by comparing with the recommended time. */
  async recordStart(recommendation: Module7FireRecommendation): Promise<void> {
    const key = recommendation.ticketId + ':' + recommendation.itemId;
    if (this.startedItemsState()[key]) return;

    const actualStartAt = new Date();
    const followed =
      Math.abs(actualStartAt.getTime() - recommendation.recommendedStartAt.getTime()) <=
      FOLLOW_TOLERANCE_MINUTES * 60_000;

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

    const { error } = await this.db.from('fire_time_recommendation').insert({
      ticket_item_id: Number(recommendation.itemId),
      recommended_start_time: recommendation.recommendedStartAt.toISOString(),
      actual_start_time: actualStartAt.toISOString(),
      followed,
    });
    if (error) {
      console.error('Could not save fire-time log', error);
      void this.load();
      return;
    }

    // First item started => the ticket automatically moves from pending to preparing.
    const dbTicketId = Number(recommendation.ticketId.replace('TKT-', ''));
    const { data: moved } = await this.db
      .from('ticket')
      .update({ current_stage: 'preparing' })
      .eq('ticket_id', dbTicketId)
      .eq('current_stage', 'pending')
      .select('ticket_id');
    if (moved && moved.length) {
      await this.db
        .from('stage_transition')
        .insert({ ticket_id: dbTicketId, stage: 'preparing', changed_at: actualStartAt.toISOString() });
    }
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