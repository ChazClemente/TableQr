import { Injectable, computed, inject, signal } from '@angular/core';
import { MenuItem, type Category } from '../data/menu';
import { OrderService, type DbLatestOrder } from './order.service';

export interface CartItem {
  item: MenuItem;
  qty: number;
}

export interface PlacedOrder {
  tableId: string;
  items: CartItem[];
  placedAt: Date;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served';

export interface Order {
  id: string;
  orderId?: number; // totoong order_id sa database
  tableId: string;
  items: CartItem[];
  total: number; // kasama na ang 5% service charge
  status: OrderStatus;
  placedAt: Date;
}

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
const POLL_MS = 4000;

@Injectable({ providedIn: 'root' })
export class CartService {
  private orders = inject(OrderService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private trackedTable: string | null = null;

  items = signal<CartItem[]>([]);
  count = computed(() => this.items().reduce((sum, c) => sum + c.qty, 0));
  total = computed(() => this.items().reduce((sum, c) => sum + c.qty * c.item.price, 0));

  lastOrder = signal<PlacedOrder | null>(null);
  order = signal<Order | null>(null);

  addToCart(item: MenuItem) {
    this.items.update(list => {
      const existing = list.find(c => c.item.id === item.id);
      return existing
        ? list.map(c => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c))
        : [...list, { item, qty: 1 }];
    });
  }

  updateQty(itemId: string, qty: number) {
    if (qty <= 0) {
      this.removeFromCart(itemId);
      return;
    }
    this.items.update(list => list.map(c => (c.item.id === itemId ? { ...c, qty } : c)));
  }

  removeFromCart(itemId: string) {
    this.items.update(list => list.filter(c => c.item.id !== itemId));
  }

  clear() {
    this.items.set([]);
  }

  /** Nagta-throw ng Error kapag pumalya. Hindi nawawala ang cart kapag failed. */
  async submitOrder(tableId: string): Promise<void> {
    const items = this.items();
    if (!items.length) return;

    const placed = await this.orders.place(
      tableId,
      items.map(c => ({ menuId: Number(c.item.id), quantity: c.qty })),
    );

    const placedAt = new Date();
    this.lastOrder.set({ tableId, items, placedAt });
    this.order.set({
      id: placed.code,
      orderId: placed.orderId,
      tableId,
      items,
      total: placed.total,
      status: 'pending',
      placedAt,
    });

    this.clear();
    this.startTracking(tableId);
  }
  updateOrderStatus(status: OrderStatus) {
  this.order.update(o => (o ? { ...o, status } : o));
}

  getOrder() {
    return this.order();
  }

  setStatus(status: OrderStatus) {
    this.order.update(o => (o ? { ...o, status } : o));
  }

  /** Kunin ang pinakabagong order mula sa database (para sa refresh at polling). */
  async loadLatest(tableId: string): Promise<void> {
    const db = await this.orders.latest(tableId);
    if (!db) return;
    this.applyDb(tableId, db);
  }

  /** Simulan ang polling. Ligtas tawagin nang paulit-ulit. */
  startTracking(tableId: string) {
    if (this.timer && this.trackedTable === tableId) return;
    this.stopTracking();
    this.trackedTable = tableId;

    const tick = async () => {
      try {
        await this.loadLatest(tableId);
        if (this.order()?.status === 'served') this.stopTracking();
      } catch {
        // pansamantalang network error: subukan ulit sa susunod na tick
      }
    };

    tick();
    this.timer = setInterval(tick, POLL_MS);
  }

  stopTracking() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.trackedTable = null;
  }

  private applyDb(tableId: string, db: DbLatestOrder) {
    const status = (STATUSES as string[]).includes(db.status) ? (db.status as OrderStatus) : 'pending';

    const items: CartItem[] = db.items.map(i => ({
      qty: i.quantity,
      item: {
        id: String(i.menuId),
        name: i.name,
        description: i.description ?? '',
        price: i.price,
        category: i.category as Category,
        available: i.available,
        image: i.image ?? '',
      },
    }));

    const prev = this.order();
    this.order.set({
      id: db.code,
      orderId: db.orderId,
      tableId,
      items,
      total: db.total,
      status,
      placedAt: prev && prev.orderId === db.orderId ? prev.placedAt : new Date(),
    });
  }
}