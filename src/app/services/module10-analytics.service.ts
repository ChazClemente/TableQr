import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../store/supabase.service'; // <-- ayusin ang path
import { Module10CategoryEstimate, Module10HourlyVolume, Module10OrderTimestampEvent } from '../core/models/module10.model';

const HOUR_MS = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class Module10AnalyticsService {
  private readonly db = inject(SupabaseService).client;
  private readonly destroyRef = inject(DestroyRef);
  private reloadTimer = 0;

  private readonly threshold = signal(10);
  private readonly estimateState = signal<Module10CategoryEstimate[]>([]);
  private readonly orderEventsState = signal<Module10OrderTimestampEvent[]>([]);

  readonly orderEvents = this.orderEventsState.asReadonly();
  get peakThreshold(): number { return this.threshold(); }
  get estimates(): Module10CategoryEstimate[] { return this.estimateState(); }

  constructor() {
    const channel = this.db.channel('module10-live');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'ticket' }, () => this.scheduleReload());
    channel.subscribe();
    this.destroyRef.onDestroy(() => {
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
    const since = new Date(Date.now() - 48 * HOUR_MS).toISOString();
    const [tickets, bench, setting] = await Promise.all([
      this.db.from('ticket').select('order_id, submission_timestamp')
        .gte('submission_timestamp', since).order('submission_timestamp'),
      this.db.from('category_benchmark')
        .select('category_id, category_name, benchmark_min_minutes, benchmark_max_minutes').order('category_id'),
      this.db.from('kitchen_setting').select('value').eq('key', 'peak_threshold').maybeSingle(),
    ]);
    const err = tickets.error ?? bench.error ?? setting.error;
    if (err) { console.error('Module 10 load failed', err); return; }

    const t = Number((setting.data as any)?.value);
    if (Number.isFinite(t)) this.threshold.set(t);

    this.estimateState.set((bench.data ?? []).map((b: any) => ({
      category: String(b.category_name).toUpperCase(),
      minMinutes: Number(b.benchmark_min_minutes),
      maxMinutes: Number(b.benchmark_max_minutes),
      prepMinutes: Number(b.benchmark_max_minutes),
    })));

    this.orderEventsState.set((tickets.data ?? []).map((r: any) => ({
      orderId: r.order_id,
      occurredAt: new Date(r.submission_timestamp),
      source: 'Module 6' as const,
    })));
  }

  hourlyVolumes(now: Date, numberOfHours = 24): Module10HourlyVolume[] {
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    const start = currentHour.getTime() - (numberOfHours - 1) * HOUR_MS;
    const counts = new Map<number, number>();
    for (const event of this.orderEventsState()) {
      const h = new Date(event.occurredAt);
      h.setMinutes(0, 0, 0);
      const hour = h.getTime();
      if (hour >= start && hour <= currentHour.getTime()) counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }
    return Array.from({ length: numberOfHours }, (_, i) => {
      const hour = start + i * HOUR_MS;
      const orderCount = counts.get(hour) ?? 0;
      return {
        hourStart: new Date(hour),
        orderCount,
        finalized: hour < currentHour.getTime(),
        isPeak: orderCount > this.threshold(),
      };
    });
  }
}