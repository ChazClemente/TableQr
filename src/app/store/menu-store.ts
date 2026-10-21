import { Injectable, inject, signal, computed } from '@angular/core';
import type { MenuItem, Category } from '../data/menu';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MenuStore {
  private sb = inject(SupabaseService).client;

  readonly items = signal<MenuItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  
  // Store the category emojis here
  readonly categoryEmojis = signal<Record<string, string>>({});

  // Dynamically extract categories from the loaded items
  readonly categories = computed(() => {
    const allCats = this.items().map(i => i.category);
    return [...new Set(allCats)].sort() as Category[];
  });

  constructor() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    
    // 1. Fetch the menu items
    const { data: menuData, error: menuError } = await this.sb
      .from('menu') 
      .select('*')
      .order('menu_name');

    if (menuError) {
      this.error.set(menuError.message);
      console.error("Menu Error:", menuError);
      this.loading.set(false);
      return;
    }

    // 2. Try to fetch the emojis from menu_items (if the table exists)
    try {
      const { data: emojiData } = await this.sb.from('menu_items').select('category, emoji');
      if (emojiData) {
        const emojiMap: Record<string, string> = {};
        emojiData.forEach((row: any) => {
          if (row.category && row.emoji) {
            emojiMap[row.category] = row.emoji;
          }
        });
        this.categoryEmojis.set(emojiMap);
      }
    } catch (e) {
      console.warn("Could not load emojis from menu_items", e);
    }

    // 3. Map the menu items
    const mappedItems: MenuItem[] = (menuData ?? []).map((m: any) => ({
      id: String(m.menu_id),
      name: m.menu_name,
      description: m.description || '', 
      price: Number(m.price),
      category: m.menu_category as Category,
      available: m.stock_status !== 'out_of_stock', 
      image: m.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop', 
      popular: m.popular || false, 
    }));

    this.items.set(mappedItems);
    this.loading.set(false);
  }
}