import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { downloadFile } from '../../../shared/download';
import {
  SupabaseService,
  type AuditEventRecord,
  type AuditEventType,
  type AuditSeverity,
  type StaffProfile,
} from '../../../store/supabase.service';

const ACTION_META: Record<AuditEventType, { label: string; icon: string; sev: AuditSeverity }> = {
  staff_signed_in:      { label: 'Staff Sign-in',      icon: '🔑', sev: 'info' },
  staff_signed_out:     { label: 'Staff Sign-out',     icon: '🚪', sev: 'info' },
  staff_invited:        { label: 'Staff Invited',      icon: '✉️', sev: 'info' },
  staff_profile_updated:{ label: 'Profile Updated',    icon: '✏️', sev: 'info' },
  staff_role_changed:   { label: 'Role Changed',       icon: '🛡', sev: 'warn' },
  staff_activated:      { label: 'Account Activated',  icon: '🔓', sev: 'warn' },
  staff_deactivated:    { label: 'Account Deactivated',icon: '🔒', sev: 'warn' },
  price_change:         { label: 'Price Change',       icon: '💰', sev: 'warn' },
  menu_add:             { label: 'Menu Item Added',    icon: '➕', sev: 'info' },
  menu_delete:          { label: 'Menu Item Deleted',  icon: '🗑', sev: 'warn' },
  bill_void:            { label: 'Bill Void',          icon: '❌', sev: 'critical' },
  discount_applied:     { label: 'Discount Applied',   icon: '🏷', sev: 'warn' },
};

const SEV_STYLE = {
  info:     { bg: '#F4ECD8', text: '#9B7B5A', border: '#C4A882' },
  warn:     { bg: '#D4A84312', text: '#8B6914', border: '#D4A84350' },
  critical: { bg: '#C0392B12', text: '#C0392B', border: '#C0392B50' },
};

const ALL_ACTIONS = Object.keys(ACTION_META) as AuditEventType[];
const PAGE_SIZE = 15;

interface DisplayAuditEvent {
  id: string;
  action: AuditEventType;
  userId: string | null;
  userName: string;
  detail: string;
  at: Date;
  severity: AuditSeverity;
}

@Component({
  selector: 'app-audit-log',
  imports: [RouterLink, FormsModule],
  templateUrl: './audit-log.html',
})
export class AuditLog implements OnInit {
  private supabase = inject(SupabaseService);

  actionMeta = ACTION_META;
  sevStyle = SEV_STYLE;
  allActions = ALL_ACTIONS;
  summary: [AuditSeverity, string][] = [['info', 'Informational'], ['warn', 'Warnings'], ['critical', 'Critical']];

  events: DisplayAuditEvent[] = [];
  users: StaffProfile[] = [];
  counts: Record<AuditSeverity, number> = { info: 0, warn: 0, critical: 0 };
  totalCount = 0;
  loading = true;
  exporting = false;
  accessGranted = false;
  error = '';

  filterSev: AuditSeverity | 'all' = 'all';
  filterAction: AuditEventType | 'all' = 'all';
  filterUser = 'all';
  search = '';
  page = 0;

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    this.accessGranted = false;
    try {
      const profile = await this.supabase.getCurrentStaffProfile();
      if (!profile) {
        this.error = 'Sign in with a Supabase staff account to view audit events.';
        return;
      }
      if (!profile.active || profile.role !== 'admin') {
        this.error = 'Audit events are available to active administrators only.';
        return;
      }
      this.accessGranted = true;
      this.users = await this.supabase.listStaffProfiles();
      await this.loadPage(0);
    } catch (error) {
      this.error = this.errorMessage(error, 'Unable to load audit events.');
    } finally {
      this.loading = false;
    }
  }

  get paginated() { return this.events; }
  get totalPages() { return Math.ceil(this.totalCount / PAGE_SIZE); }

  count(severity: AuditSeverity) { return this.counts[severity]; }

  toggleSev(severity: AuditSeverity) {
    this.filterSev = this.filterSev === severity ? 'all' : severity;
    void this.loadPage(0);
  }

  async loadPage(page: number) {
    if (!this.accessGranted) return;
    this.page = page;
    this.loading = true;
    this.error = '';
    try {
      const result = await this.supabase.getAuditLogPage(this.page, PAGE_SIZE, {
        severity: this.filterSev,
        eventType: this.filterAction,
        actorUserId: this.filterUser,
        search: this.search,
      });
      this.events = result.events.map((event) => this.toDisplayEvent(event));
      this.totalCount = result.totalCount;
      this.counts = result.counts;
    } catch (error) {
      this.error = this.errorMessage(error, 'Unable to load audit events.');
    } finally {
      this.loading = false;
    }
  }

  formatTime(date: Date) {
    return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async handleExport() {
    this.exporting = true;
    this.error = '';
    try {
      const records = await this.supabase.exportAuditLog({
        severity: this.filterSev,
        eventType: this.filterAction,
        actorUserId: this.filterUser,
        search: this.search,
      });
      const csv = [
        'ID,Action,Actor,Subject,Detail,Event Data,Severity,Timestamp',
        ...records.map((event) => [
          event.id,
          ACTION_META[event.eventType].label,
          event.actorName,
          event.subjectName ?? '',
          event.summary,
          JSON.stringify(event.details),
          event.severity,
          event.createdAt.toISOString(),
        ].map((value) => this.csvCell(value)).join(',')),
      ].join('\r\n');
      downloadFile(csv, 'audit-log.csv', 'text/csv');
    } catch (error) {
      this.error = this.errorMessage(error, 'Unable to export audit events.');
    } finally {
      this.exporting = false;
    }
  }

  private toDisplayEvent(event: AuditEventRecord): DisplayAuditEvent {
    const changes = Object.entries(event.details)
      .filter((entry): entry is [string, { old: unknown; new: unknown }] =>
        typeof entry[1] === 'object' && entry[1] !== null && 'old' in entry[1] && 'new' in entry[1])
      .map(([field, values]) => `${field.replaceAll('_', ' ')}: ${String(values.old)} → ${String(values.new)}`);
    return {
      id: event.id,
      action: event.eventType,
      userId: event.actorUserId,
      userName: event.actorName,
      detail: changes.length ? `${event.summary} (${changes.join('; ')})` : event.summary,
      at: event.createdAt,
      severity: event.severity,
    };
  }

  private csvCell(value: string) {
    const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  private errorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    return fallback;
  }
}