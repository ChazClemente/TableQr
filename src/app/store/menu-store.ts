import { Injectable, inject, signal } from '@angular/core';
import type { MenuItem, Category } from '../data/menu';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MenuStore {
  private sb = inject(SupabaseService).client;

  readonly items = signal<MenuItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    
    // Make sure this matches your table name (could be 'Menu' or 'menu')
    const { data, error } = await this.sb
      .from('menu') 
      .select('*')
      .order('menu_name');

    if (error) {
      this.error.set(error.message);
      console.error("Menu Error:", error);
    } else {
      const mappedItems: MenuItem[] = (data ?? []).map((m: any) => ({
        id: String(m.menu_id),
        name: m.menu_name,
        description: m.description || '', 
        price: Number(m.price),
        category: m.menu_category as Category,
        available: m.stock_status !== 'out_of_stock', 
        image: m.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', 
        popular: m.is_popular || false,
      }));

      this.items.set(mappedItems);
    }
    
    this.loading.set(false);
  }
}