import { Injectable, inject, signal, computed } from '@angular/core';
import type { MenuItem, Category } from '../data/menu';
import { SupabaseService } from './supabase.service';
export interface ModifierOption { label: string; addPrice: number; }
export interface Modifier { id: string; name: string; options: ModifierOption[]; required: boolean; }

export interface ManagedMenuItem extends MenuItem {
  modifiers: Modifier[];
  tags: string[];
}
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
    async saveMenuItem(item: ManagedMenuItem, isNew: boolean) {
    const row = {
      menu_name: item.name,
      description: item.description,
      price: item.price,
      menu_category: item.category,
      image_url: item.image || null,
      popular: item.popular ?? false,
      stock_status: item.available ? 'in_stock' : 'out_of_stock',
    };

    const { error } = isNew
      ? await this.sb.from('menu').insert(row)
      : await this.sb.from('menu').update(row).eq('menu_id', item.id);

    if (error) { console.error('Save menu error:', error); throw error; }
    await this.load();
  }

  async deleteMenuItem(id: string) {
    const { error } = await this.sb.from('menu').delete().eq('menu_id', id);
    if (error) { console.error('Delete menu error:', error); throw error; }
    await this.load();
  }

  async toggleAvailable(id: string) {
    const item = this.items().find(i => i.id === id);
    if (!item) return;
    const { error } = await this.sb
      .from('menu')
      .update({ stock_status: item.available ? 'out_of_stock' : 'in_stock' })
      .eq('menu_id', id);
    if (error) { console.error('Toggle error:', error); throw error; }
    await this.load();
  }
  async setAvailable(id: string, available: boolean) {
  const { error } = await this.sb
    .from('menu')
    .update({ stock_status: available ? 'in_stock' : 'out_of_stock' })
    .eq('menu_id', id);
  if (error) throw error;
  this.items.update(list => list.map(i => (i.id === id ? { ...i, available } : i)));
}
}