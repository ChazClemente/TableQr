import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase';
import type { Category, MenuItem } from '../data/menu';

@Injectable({ providedIn: 'root' })
export class MenuService {
  readonly items = signal<MenuItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await supabase
      .from('menu')
      .select('menu_id, menu_name, menu_category, price, stock_status, description, image_url, popular')
      .order('menu_id', { ascending: true });

    if (error) {
      this.error.set(error.message);
      this.loading.set(false);
      return;
    }

    this.items.set(
      (data ?? []).map((r: any): MenuItem => ({
        id: String(r.menu_id),
        name: r.menu_name,
        description: r.description ?? '',
        price: Number(r.price),
        category: r.menu_category as Category,
        available: r.stock_status === 'available',
        image: r.image_url ?? '',
        popular: !!r.popular,
      })),
    );
    this.loading.set(false);
  }
}