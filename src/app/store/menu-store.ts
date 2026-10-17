import { Injectable, inject, signal } from '@angular/core';
import type { MenuItem } from '../data/menu';
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
    const { data, error } = await this.sb.from('menu_items').select('*').order('name');
    if (error) this.error.set(error.message);
    else this.items.set(data as MenuItem[]);
    this.loading.set(false);
  }
}