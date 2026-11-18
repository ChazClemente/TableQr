import { Injectable } from '@angular/core';
import { supabase } from './supabase';
import { OrderService } from './order.service';

export type PayMethod = 'cash' | 'gcash' | 'maya';

export interface DbBill {
  billId: number;
  orderId: number;
  code: string;
  total: number;
  billStatus: string; // 'unpaid' | 'paid'
  billRequested: boolean;
  payment: { method: string; reference: string | null; status: string } | null;
}
export interface DiscountInfo {
  status: 'none' | 'approved';
  type: 'senior' | 'pwd' | null;
  discountAmount: number;
}
@Injectable({ providedIn: 'root' })

export class PaymentService {
  private token(tableId: string) {
    return sessionStorage.getItem(OrderService.tokenKey(tableId)) ?? '';
  }
  

  async getBill(tableId: string): Promise<DbBill | null> {
    const { data, error } = await supabase.rpc('get_bill', {
      p_table_id: OrderService.tableNumber(tableId),
      p_token: this.token(tableId),
    });
    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      billId: data.billId,
      orderId: data.orderId,
      code: OrderService.code(data.orderId),
      total: Number(data.total),
      billStatus: data.billStatus,
      billRequested: data.billRequested,
      payment: data.payment,
    };
  }

  /** GCash / Maya: creates a PayMongo checkout and returns the URL. */
  async startCheckout(tableId: string, method: 'gcash' | 'maya'): Promise<string> {
    const token = this.token(tableId);
    if (!token) throw new Error('Invalid session: missing');

    const returnUrl = `${location.origin}/table/${tableId}/payment?token=${encodeURIComponent(token)}`;

    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        tableId: OrderService.tableNumber(tableId),
        token,
        method,
        returnUrl,
      },
    });

    if (error) {
      let msg = error.message;
      try {
        const body = await (error as any).context?.json();
        if (body?.error) msg = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }

    if (!data?.checkoutUrl) throw new Error('No checkout url');
    return data.checkoutUrl as string;
  }

  /** Cash: notify the cashier. */
  async payCash(tableId: string): Promise<void> {
    const { error } = await supabase.rpc('submit_payment', {
      p_table_id: OrderService.tableNumber(tableId),
      p_token: this.token(tableId),
      p_method: 'cash',
      p_reference: null,
      p_proof: null,
    });
    if (error) throw new Error(error.message);
  }
    /** Senior/PWD discount status of the table bill. */
  async getDiscount(tableId: string): Promise<DiscountInfo> {
    const { data, error } = await supabase.rpc('get_discount_request', {
      p_table_id: OrderService.tableNumber(tableId),
      p_token: this.token(tableId),
    });
    if (error) throw new Error(error.message);
    return {
      status: data?.status === 'approved' ? 'approved' : 'none',
      type: data?.type ?? null,
      discountAmount: Number(data?.discountAmount ?? 0),
    };
  }

  /** Apply the Senior/PWD discount to the bill immediately (no cashier verification). */
  async applyDiscount(
    tableId: string,
    input: { type: 'senior' | 'pwd'; name: string; idNumber: string; cardData?: string },
  ): Promise<void> {
    const { error } = await supabase.rpc('apply_discount_self', {
      p_table_id: OrderService.tableNumber(tableId),
      p_token: this.token(tableId),
      p_type: input.type,
      p_name: input.name,
      p_id_number: input.idNumber,
      p_card_data: input.cardData ?? null,
    });
    if (error) throw new Error(error.message);
  }
    /** The server asks PayMongo whether it has been paid (webhook backup). */
  async verify(tableId: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: {
        tableId: OrderService.tableNumber(tableId),
        token: this.token(tableId),
      },
    });
    if (error) return false;
    return !!data?.paid;
  }
}