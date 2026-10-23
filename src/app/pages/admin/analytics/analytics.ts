import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SupabaseService,
  type AnalyticsPrepBenchmark,
  type AnalyticsSampleData,
  type AnalyticsSampleOrder,
} from '../../../store/supabase.service';
import { downloadFile } from '../../../shared/download';
import { NumPipe } from '../../../shared/num.pipe';

const WEEKDAYS = [
  { label: 'Mon', day: 1 },
  { label: 'Tue', day: 2 },
  { label: 'Wed', day: 3 },
  { label: 'Thu', day: 4 },
  { label: 'Fri', day: 5 },
  { label: 'Sat', day: 6 },
  { label: 'Sun', day: 0 },
];
const CATEGORY_COLORS: Record<string, string> = {
  Pampagana: '#7A3B1E',
  Sabaw: '#4A7C59',
  Ulam: '#8B6914',
  'Kanin & Pansit': '#5C2E0A',
  Merienda: '#C0392B',
  Inumin: '#2C6080',
};
const HOURS = Array.from({ length: 24 }, (_, hour) => {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
});

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Component({
  selector: 'app-analytics',
  imports: [RouterLink, NumPipe],
  templateUrl: './analytics.html',
})
export class Analytics implements OnInit {
  private supabase = inject(SupabaseService);

  range: 7 | 14 = 14;
  ranges = [7, 14] as const;
  hours = HOURS;
  evenHours = HOURS.filter((_, index) => index % 2 === 0);
  analyticsData: AnalyticsSampleData = { orders: [], items: [], benchmarks: [] };
  loading = true;
  accessGranted = false;
  error = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.accessGranted = false;

    try {
      const profile = await this.supabase.getCurrentStaffProfile();
      if (!profile) {
        this.error = 'Sign in with a Supabase staff account to view analytics.';
        return;
      }
      if (!profile.active || profile.role !== 'admin') {
        this.error = 'Analytics are available to active administrators only.';
        return;
      }

      const now = new Date();
      const firstDay = startOfDay(now);
      firstDay.setDate(firstDay.getDate() - 13);
      this.analyticsData = await this.supabase.getAnalyticsSampleData(firstDay, now, 'real');
      this.accessGranted = true;
    } catch (error) {
      this.error = this.errorMessage(error, 'Unable to load analytics data.');
    } finally {
      this.loading = false;
    }
  }

  get visibleDays() {
    const today = startOfDay(new Date());
    const periodStart = new Date(today);
    periodStart.setDate(today.getDate() - this.range + 1);
    const salesByDate = new Map<string, { sales: number; transactions: number }>();

    for (const order of this.analyticsData.orders) {
      const date = startOfDay(order.createdAt);
      if (date < periodStart || date > today) continue;
      const key = date.toISOString().slice(0, 10);
      const summary = salesByDate.get(key) ?? { sales: 0, transactions: 0 };
      summary.sales += order.total;
      summary.transactions++;
      salesByDate.set(key, summary);
    }

    return Array.from({ length: this.range }, (_, index) => {
      const date = new Date(periodStart);
      date.setDate(periodStart.getDate() + index);
      const summary = salesByDate.get(date.toISOString().slice(0, 10));
      return {
        date,
        label: date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        sales: summary?.sales ?? 0,
        transactions: summary?.transactions ?? 0,
      };
    });
  }

  get maxSales(): number {
    return Math.max(0, ...this.visibleDays.map((day) => day.sales));
  }

  get bestSellers() {
    const products = new Map<number, {
      id: number;
      name: string;
      count: number;
      revenue: number;
    }>();
    const firstDay = this.visibleDays[0]?.date;
    if (!firstDay) return [];
    const ordersById = new Map(this.analyticsData.orders.map((order) => [order.id, order]));
    const tomorrow = startOfDay(new Date());
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const item of this.analyticsData.items) {
      const order = ordersById.get(item.orderId);
      if (!order || order.createdAt < firstDay || order.createdAt >= tomorrow) continue;
      const product = products.get(item.menuItemId) ?? {
        id: item.menuItemId,
        name: item.name,
        count: 0,
        revenue: 0,
      };
      product.count += item.quantity;
      product.revenue += item.revenue;
      products.set(item.menuItemId, product);
    }

    return [...products.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }

  get maxCount(): number {
    return this.bestSellers[0]?.count ?? 1;
  }

  get heatmap() {
    const now = new Date();
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    const counts = WEEKDAYS.map(() => Array.from({ length: 24 }, () => 0));
    let orderCount = 0;

    for (const order of this.analyticsData.orders) {
      if (order.createdAt < start || order.createdAt > now) continue;
      const dayIndex = WEEKDAYS.findIndex((weekday) => weekday.day === order.createdAt.getDay());
      if (dayIndex < 0) continue;
      counts[dayIndex][order.createdAt.getHours()]++;
      orderCount++;
    }

    return {
      rows: WEEKDAYS.map((weekday, index) => ({ day: weekday.label, hours: counts[index] })),
      orderCount,
      max: Math.max(0, ...counts.flat()),
    };
  }

  get serviceSpeed(): (AnalyticsPrepBenchmark & { color: string })[] {
    return this.analyticsData.benchmarks.map((benchmark) => ({
      ...benchmark,
      color: CATEGORY_COLORS[benchmark.category] ?? '#7A3B1E',
    }));
  }

  get maxServiceMinutes(): number {
    return Math.max(1, ...this.serviceSpeed.map((item) => item.maxMinutes));
  }

  get kpis() {
    const days = this.visibleDays;
    const totalSales = days.reduce((sum, day) => sum + day.sales, 0);
    const totalTransactions = days.reduce((sum, day) => sum + day.transactions, 0);
    const averageOrderValue = totalTransactions ? totalSales / totalTransactions : 0;
    const benchmarks = this.analyticsData.benchmarks;
    const averagePrepTarget = benchmarks.length
      ? benchmarks.reduce((sum, item) => sum + (item.minMinutes + item.maxMinutes) / 2, 0) / benchmarks.length
      : null;

    return [
      { label: 'Settled Sample Sales', value: formatCurrency(totalSales), sub: `${this.range}-day period`, color: '#7A3B1E' },
      { label: 'Sample Transactions', value: totalTransactions.toLocaleString(), sub: 'paid demo orders', color: '#4A7C59' },
      { label: 'Avg. Order Value', value: totalTransactions ? formatCurrency(averageOrderValue) : '—', sub: 'per transaction', color: '#8B6914' },
      { label: 'Avg. Prep Target', value: averagePrepTarget === null ? '—' : `${averagePrepTarget.toFixed(1)} min`, sub: 'benchmark midpoint', color: '#C0392B' },
    ];
  }

  get hasSales(): boolean {
    return this.visibleDays.some((day) => day.transactions > 0);
  }

  revenuePct(sales: number): number {
    return this.maxSales > 0 ? (sales / this.maxSales) * 100 : 0;
  }

  heatColor(value: number): string {
    const max = this.heatmap.max;
    const intensity = max > 0 ? value / max : 0;
    if (intensity === 0) return '#F4ECD8';
    if (intensity < 0.25) return '#E8D5B0';
    if (intensity < 0.5) return '#C4A882';
    if (intensity < 0.75) return '#9B6B3A';
    return '#7A3B1E';
  }

  handleExport(): void {
    const csv = [
      ['Date', 'Settled Sample Sales (PHP)', 'Sample Transactions'].map(csvCell).join(','),
      ...this.visibleDays.map((day) =>
        [day.label, day.sales, day.transactions].map(csvCell).join(','),
      ),
    ].join('\r\n');
    downloadFile(csv, 'analytics-sample.csv', 'text/csv');
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    return fallback;
  }
}