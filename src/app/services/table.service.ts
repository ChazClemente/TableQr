import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { supabase } from './supabase';

export interface TableDto {
  id: string;
  label: string;
  token: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  sessionStatus: string;
  active: boolean;
}

const SESSION_HOURS = 4;

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

function toDto(r: any): TableDto {
  const expires = new Date(r.expires_at);
  return {
    id: 'T' + String(r.table_id).padStart(2, '0'),
    label: r.table_number,
    token: r.qr_token,
    url: r.session_link,
    createdAt: new Date(expires.getTime() - SESSION_HOURS * 3600 * 1000).toISOString(),
    expiresAt: expires.toISOString(),
    sessionStatus: r.session_status,
    active: r.table_status === 'active',
  };
}

function numId(code: string): number {
  return Number(code.replace(/\D/g, ''));
}

@Injectable({ providedIn: 'root' })
export class TableService {
  // Dito dadalhin ng QR ang customer (kung saan nakabukas ang admin page)
  private baseUrl = window.location.origin;

  private one(tableId: number): Observable<TableDto> {
    return from(supabase.from('v_tables').select('*').eq('table_id', tableId).single()).pipe(
      map(res => toDto(unwrap(res))),
    );
  }

  list(): Observable<TableDto[]> {
    return from(supabase.from('v_tables').select('*').order('table_id')).pipe(
      map(res => (unwrap(res) ?? []).map(toDto)),
    );
  }

  add(label: string): Observable<TableDto> {
    return from(supabase.rpc('create_table', { p_label: label, p_base_url: this.baseUrl })).pipe(
      map(res => unwrap(res) as number),
      switchMap(id => this.one(id)),
    );
  }

  regenerate(id: string): Observable<TableDto> {
    const n = numId(id);
    return from(supabase.rpc('issue_session', { p_table_id: n, p_base_url: this.baseUrl })).pipe(
      map(res => unwrap(res)),
      switchMap(() => this.one(n)),
    );
  }

  toggle(id: string): Observable<TableDto> {
    const n = numId(id);
    return from(supabase.rpc('toggle_table', { p_table_id: n })).pipe(
      map(res => unwrap(res)),
      switchMap(() => this.one(n)),
    );
  }

  validate(table: string, token: string) {
    return from(supabase.rpc('validate_session', { p_table_id: numId(table), p_token: token })).pipe(
      map(res => unwrap(res) as { valid: boolean; reason?: string; expiresAt?: string }),
    );
  }
}