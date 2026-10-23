import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SupabaseRuntimeConfig {
  url: string;
  publishableKey: string;
}

export type StaffRole = 'admin' | 'cashier' | 'kitchen';
export type AuditEventType =
  | 'staff_signed_in'
  | 'staff_signed_out'
  | 'staff_invited'
  | 'staff_profile_updated'
  | 'staff_role_changed'
  | 'staff_activated'
  | 'staff_deactivated'
  | 'price_change'
  | 'menu_add'
  | 'menu_delete'
  | 'bill_void'
  | 'discount_applied';
export type AuditSeverity = 'info' | 'warn' | 'critical';

export interface AuditEventRecord {
  id: string;
  eventType: AuditEventType;
  actorUserId: string | null;
  actorName: string;
  subjectUserId: string | null;
  subjectName: string | null;
  summary: string;
  details: Record<string, unknown>;
  severity: AuditSeverity;
  createdAt: Date;
}

export interface AuditFilters {
  severity?: AuditSeverity | 'all';
  eventType?: AuditEventType | 'all';
  actorUserId?: string | 'all';
  search?: string;
}

interface AuditLogRow {
  id: string;
  event_type: AuditEventType;
  actor_user_id: string | null;
  actor_name: string;
  subject_user_id: string | null;
  subject_name: string | null;
  summary: string;
  details: Record<string, unknown>;
  severity: AuditSeverity;
  created_at: string;
}

export interface AuditLogPage {
  events: AuditEventRecord[];
  totalCount: number;
  counts: Record<AuditSeverity, number>;
}

export interface StaffInviteInput {
  email: string;
  displayName: string;
  username: string;
  role: StaffRole;
}

export interface InvitedStaffUser extends StaffInviteInput {
  id: string;
  isActive: boolean;
}

export interface StaffProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  role: StaffRole;
  active: boolean;
  createdAt: Date;
}

export interface AnalyticsSampleOrder {
  id: number;
  createdAt: Date;
  total: number;
}

export interface AnalyticsSampleItem {
  orderId: number;
  menuItemId: number;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export interface AnalyticsPrepBenchmark {
  category: string;
  minMinutes: number;
  maxMinutes: number;
}

export interface AnalyticsSampleData {
  orders: AnalyticsSampleOrder[];
  items: AnalyticsSampleItem[];
  benchmarks: AnalyticsPrepBenchmark[];
}

interface StaffProfileRow {
  user_id: string;
  display_name: string;
  email: string | null;
  username: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

interface AnalyticsOrderRow {
  order_id: number;
  created_at: string;
}

interface AnalyticsBillRow {
  bill_id: number;
  order_id: number;
  total_amount: number;
}

interface AnalyticsPaymentRow {
  bill_id: number;
}

interface AnalyticsOrderItemRow {
  order_id: number;
  menu_id: number;
  quantity: number;
  item_subtotal: number;
}

interface AnalyticsMenuRow {
  menu_id: number;
  menu_name: string;
  menu_category: string;
}

interface AnalyticsBenchmarkRow {
  category_name: string;
  benchmark_min_minutes: number;
  benchmark_max_minutes: number;
}

declare global {
  interface Window {
    __SUPABASE_CONFIG__?: SupabaseRuntimeConfig;
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    const config = window.__SUPABASE_CONFIG__;
    if (!config?.url || !config.publishableKey) {
      throw new Error(
        'Supabase is not configured. Copy public/supabase-config.example.js to public/supabase-config.js and set your project URL and publishable key.',
      );
    }

    this.client = createClient(config.url, config.publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async signOut(): Promise<void> {
    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    if (sessionError) throw sessionError;

    let auditError: Error | null = null;
    if (sessionData.session) {
      try {
        await this.recordStaffAuthEvent('staff_signed_out');
      } catch (error) {
        auditError = error instanceof Error ? error : new Error('Unable to record sign-out.');
      }
    }

    const { error } = await this.client.auth.signOut();
    if (error) throw error;
    if (auditError) throw auditError;
  }

  async recordStaffAuthEvent(eventType: 'staff_signed_in' | 'staff_signed_out'): Promise<void> {
    const { error } = await this.client.rpc('record_staff_auth_event', { p_event_type: eventType });
    if (error) throw error;
  }

  async getCurrentStaffProfile(): Promise<StaffProfile | null> {
    const { data: userData, error: userError } = await this.client.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) return null;

    const { data, error } = await this.client
      .from('profiles')
      .select('user_id,display_name,email,username,role,is_active,created_at')
      .eq('user_id', userData.user.id)
      .maybeSingle<StaffProfileRow>();
    if (error) throw error;
    return data ? this.toStaffProfile(data) : null;
  }

  async listStaffProfiles(): Promise<StaffProfile[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('user_id,display_name,email,username,role,is_active,created_at')
      .order('created_at', { ascending: false })
      .returns<StaffProfileRow[]>();
    if (error) throw error;
    return data.map((row) => this.toStaffProfile(row));
  }

  async updateStaffProfile(
    id: string,
    updates: Pick<StaffProfile, 'name' | 'username' | 'role' | 'active'>,
  ): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .update({
        display_name: updates.name.trim(),
        username: updates.username.trim().toLowerCase(),
        role: updates.role,
        is_active: updates.active,
      })
      .eq('user_id', id);
    if (error) throw error;
  }

  async inviteStaffUser(input: StaffInviteInput): Promise<InvitedStaffUser> {
    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      throw new Error('Sign in with an active administrator account before inviting staff.');
    }

    const { data, error } = await this.client.functions.invoke<{ user: InvitedStaffUser }>(
      'admin-invite-user',
      { body: input },
    );
    if (error) throw error;
    if (!data?.user) throw new Error('The invitation completed without returning a staff profile.');
    return data.user;
  }

  async getAuditLogPage(
    page: number,
    pageSize: number,
    filters: AuditFilters,
  ): Promise<AuditLogPage> {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const [{ data, error, count }, counts] = await Promise.all([
      this.auditLogQuery(filters).range(start, end),
      this.getAuditCounts(),
    ]);
    if (error) throw error;
    return {
      events: (data ?? []).map((row) => this.toAuditEvent(row)),
      totalCount: count ?? 0,
      counts,
    };
  }

  async exportAuditLog(filters: AuditFilters): Promise<AuditEventRecord[]> {
    const batchSize = 1000;
    const events: AuditEventRecord[] = [];
    for (let start = 0; ; start += batchSize) {
      const { data, error } = await this.auditLogQuery(filters).range(start, start + batchSize - 1);
      if (error) throw error;
      const rows = data ?? [];
      events.push(...rows.map((row) => this.toAuditEvent(row)));
      if (rows.length < batchSize) return events;
    }
  }

  async getAnalyticsSampleData(start: Date, end: Date): Promise<AnalyticsSampleData> {
    const [ordersResult, benchmarksResult] = await Promise.all([
      this.client
        .from('orders')
        .select('order_id,created_at')
        .eq('is_sample', true)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true })
        .returns<AnalyticsOrderRow[]>(),
      this.client
        .from('category_benchmark')
        .select('category_name,benchmark_min_minutes,benchmark_max_minutes')
        .order('category_id', { ascending: true })
        .returns<AnalyticsBenchmarkRow[]>(),
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (benchmarksResult.error) throw benchmarksResult.error;

    const benchmarks = (benchmarksResult.data ?? []).map((row) => ({
      category: row.category_name,
      minMinutes: row.benchmark_min_minutes,
      maxMinutes: row.benchmark_max_minutes,
    }));
    const orderRows = ordersResult.data ?? [];
    if (!orderRows.length) return { orders: [], items: [], benchmarks };

    const orderIds = orderRows.map((row) => row.order_id);
    const { data: bills, error: billsError } = await this.client
      .from('bill')
      .select('bill_id,order_id,total_amount')
      .in('order_id', orderIds)
      .eq('bill_status', 'paid')
      .returns<AnalyticsBillRow[]>();
    if (billsError) throw billsError;
    if (!bills?.length) return { orders: [], items: [], benchmarks };

    const billIds = bills.map((row) => row.bill_id);
    const { data: payments, error: paymentsError } = await this.client
      .from('payment')
      .select('bill_id')
      .in('bill_id', billIds)
      .eq('payment_status', 'paid')
      .returns<AnalyticsPaymentRow[]>();
    if (paymentsError) throw paymentsError;

    const paidBillIds = new Set((payments ?? []).map((row) => row.bill_id));
    const paidBills = bills.filter((row) => paidBillIds.has(row.bill_id));
    const paidOrderIds = [...new Set(paidBills.map((row) => row.order_id))];
    const orderById = new Map(orderRows.map((row) => [row.order_id, row]));
    const orders: AnalyticsSampleOrder[] = paidBills.flatMap((bill) => {
      const order = orderById.get(bill.order_id);
      return order
        ? [{ id: order.order_id, createdAt: new Date(order.created_at), total: Number(bill.total_amount) }]
        : [];
    });
    if (!paidOrderIds.length) return { orders: [], items: [], benchmarks };

    const { data: orderItems, error: itemsError } = await this.client
      .from('order_item')
      .select('order_id,menu_id,quantity,item_subtotal')
      .in('order_id', paidOrderIds)
      .returns<AnalyticsOrderItemRow[]>();
    if (itemsError) throw itemsError;
    const itemRows = orderItems ?? [];
    const menuIds = [...new Set(itemRows.map((row) => row.menu_id))];
    if (!menuIds.length) return { orders, items: [], benchmarks };

    const { data: menuItems, error: menuError } = await this.client
      .from('menu')
      .select('menu_id,menu_name,menu_category')
      .in('menu_id', menuIds)
      .returns<AnalyticsMenuRow[]>();
    if (menuError) throw menuError;
    const menuById = new Map((menuItems ?? []).map((row) => [row.menu_id, row]));
    const items = itemRows.flatMap((row) => {
      const menuItem = menuById.get(row.menu_id);
      return menuItem
        ? [{
          orderId: row.order_id,
          menuItemId: row.menu_id,
            name: menuItem.menu_name,
            category: menuItem.menu_category,
            quantity: row.quantity,
            revenue: Number(row.item_subtotal),
          }]
        : [];
    });

    return { orders, items, benchmarks };
  }

  private auditLogQuery(filters: AuditFilters) {
    let query = this.client
      .from('audit_log')
      .select('id,event_type,actor_user_id,actor_name,subject_user_id,subject_name,summary,details,severity,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (filters.severity && filters.severity !== 'all') query = query.eq('severity', filters.severity);
    if (filters.eventType && filters.eventType !== 'all') query = query.eq('event_type', filters.eventType);
    if (filters.actorUserId && filters.actorUserId !== 'all') query = query.eq('actor_user_id', filters.actorUserId);
    if (filters.search?.trim()) {
      const searchPattern = `%${filters.search.trim().split(/\s+/).join('%')}%`;
      query = query.ilike('summary', searchPattern);
    }
    return query.returns<AuditLogRow[]>();
  }

  private async getAuditCounts(): Promise<Record<AuditSeverity, number>> {
    const severities: AuditSeverity[] = ['info', 'warn', 'critical'];
    const results = await Promise.all(severities.map(async (severity) => {
      const { count, error } = await this.client
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('severity', severity);
      if (error) throw error;
      return [severity, count ?? 0] as const;
    }));
    return Object.fromEntries(results) as Record<AuditSeverity, number>;
  }

  private toAuditEvent(row: AuditLogRow): AuditEventRecord {
    return {
      id: row.id,
      eventType: row.event_type,
      actorUserId: row.actor_user_id,
      actorName: row.actor_name,
      subjectUserId: row.subject_user_id,
      subjectName: row.subject_name,
      summary: row.summary,
      details: row.details,
      severity: row.severity,
      createdAt: new Date(row.created_at),
    };
  }

  private toStaffProfile(row: StaffProfileRow): StaffProfile {
    return {
      id: row.user_id,
      name: row.display_name,
      email: row.email ?? '',
      username: row.username ?? '',
      role: row.role,
      active: row.is_active,
      createdAt: new Date(row.created_at),
    };
  }
}