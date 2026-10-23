import { Injectable } from '@angular/core';
import { supabase } from './supabase';

export interface OrderLine {
  menuId: number;
  quantity: number;
  modifiers?: string;
}

export interface DbOrder {
  orderId: number;
  code: string; // hal. ORD-000012
  subtotal: number;
  total: number; // kasama ang service charge
  status: string;
}

export interface DbLatestItem {
  menuId: number;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image: string | null;
  available: boolean;
  quantity: number;
}

export interface DbLatestOrder {
  orderId: number;
  code: string;
  status: string;
  total: number;
  items: DbLatestItem[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  /** 'T01' -> 1 */
  static tableNumber(tableId: string): number {
    return Number(tableId.replace(/\D/g, ''));
  }

  static tokenKey(tableId: string): string {
    return `orderqr_token_${tableId}`; // pareho sa sessionGuard
  }

  static code(orderId: number): string {
    return 'ORD-' + String(orderId).padStart(6, '0');
  }

  async place(tableId: string, lines: OrderLine[]): Promise<DbOrder> {
    const token = sessionStorage.getItem(OrderService.tokenKey(tableId)) ?? '';

    const { data, error } = await supabase.rpc('place_order', {
      p_table_id: OrderService.tableNumber(tableId),
      p_token: token,
      p_items: lines,
    });

    if (error) throw new Error(error.message);

    return {
      orderId: data.orderId,
      code: OrderService.code(data.orderId),
      subtotal: Number(data.subtotal),
      total: Number(data.total),
      status: data.status,
    };
  }

  /** Pinakabagong order ng mesa sa kasalukuyang QR session. null kung wala pa. */
  async latest(tableId: string): Promise<DbLatestOrder | null> {
    const token = sessionStorage.getItem(OrderService.tokenKey(tableId)) ?? '';

    const { data, error } = await supabase.rpc('get_latest_order', {
      p_table_id: OrderService.tableNumber(tableId),
      p_token: token,
    });

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      orderId: data.orderId,
      code: OrderService.code(data.orderId),
      status: data.status,
      total: Number(data.total),
      items: (data.items ?? []).map((i: any) => ({
        ...i,
        price: Number(i.price),
        quantity: Number(i.quantity),
      })),
    };
  }
}