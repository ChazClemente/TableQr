import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MenuStore } from './menu-store';
import type { Category } from '../data/menu';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TicketStatus = 'preparing' | 'ready' | 'served';
export type OrderSource = 'qr' | 'pos';

export interface TicketItem {
  menuItemId: string;
  name: string;
  quantity: number;
  category: Category;
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  tableLabel: string;
  source: OrderSource;
  items: TicketItem[];
  status: TicketStatus;
  receivedAt: Date;
  statusHistory: { status: TicketStatus; at: Date }[];
  expectedPrepMinutes: number; // max expected prep across item categories
}

export interface StockEntry {
  menuItemId: string;
  name: string;
  category: Category;
  available: boolean;
  markedUnavailableAt?: Date;
}

// ─── Category prep time baselines (minutes) ───────────────────────────────────

export const CATEGORY_PREP: Record<Category, { min: number; max: number }> = {
  'Soup':            { min: 15, max: 20 },
  'Dry Dishes':      { min: 10, max: 15 },
  'Pulutan':         { min: 8,  max: 12 },
  'Sizzling':        { min: 10, max: 15 },
  'Noodles':         { min: 8,  max: 12 },
  'Pancit sa Bilao': { min: 20, max: 30 },
  'Sandwiches':      { min: 5,  max: 10 },
  'Panghimagas':     { min: 5,  max: 10 },
  'Beverages':       { min: 2,  max: 5  },
  'Rice':            { min: 5,  max: 10 },
  'Native Dishes':   { min: 15, max: 25 },
  'Dishes':          { min: 10, max: 15 },
  'Toppings':        { min: 8,  max: 12 },
  'Specialties':     { min: 8,  max: 12 },
  'Fish':            { min: 15, max: 20 },
  'Desserts':        { min: 3,  max: 5  },
};

function maxPrepForItems(items: TicketItem[]): number {
  return Math.max(...items.map(i => CATEGORY_PREP[i.category]?.max ?? 15));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type NewTicket = Omit<KitchenTicket, 'expectedPrepMinutes' | 'statusHistory'>;

function toTicket(t: NewTicket): KitchenTicket {
  return {
    ...t,
    statusHistory: [{ status: t.status, at: t.receivedAt }],
    expectedPrepMinutes: maxPrepForItems(t.items),
  };
}

function sortByReceived(list: KitchenTicket[]) {
  return [...list].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
}

// ─── Seed some demo tickets ───────────────────────────────────────────────────

function seedTickets(): KitchenTicket[] {
  const now = Date.now();
  const demo: NewTicket[] = [
  {
    id: 'TKT-001',
    orderId: 'ORD-A1B2C3',
    tableLabel: 'Table 2',
    source: 'qr',
    status: 'preparing',
    receivedAt: new Date(now - 18 * 60 * 1000),
    items: [
      { menuItemId: 'm49', name: 'Bulalo Special', quantity: 1, category: 'Native Dishes' },
      { menuItemId: 'm52', name: 'Adobong Baboy', quantity: 2, category: 'Native Dishes' },
      { menuItemId: 'm45', name: 'Fried Rice', quantity: 2, category: 'Rice' },
    ],
  },
  {
    id: 'TKT-002',
    orderId: 'ORD-D4E5F6',
    tableLabel: 'Counter #1',
    source: 'pos',
    status: 'ready',
    receivedAt: new Date(now - 12 * 60 * 1000),
    items: [
      { menuItemId: 'm12', name: 'Chicharong Bulaklak', quantity: 1, category: 'Pulutan' },
      { menuItemId: 'm21', name: 'Bihon Guisado', quantity: 1, category: 'Noodles' },
      { menuItemId: 'm41', name: 'Iced Tea', quantity: 2, category: 'Beverages' },
    ],
  },
  {
    id: 'TKT-003',
    orderId: 'ORD-G7H8I9',
    tableLabel: 'Table 5',
    source: 'qr',
    status: 'preparing',
    receivedAt: new Date(now - 6 * 60 * 1000),
    items: [
      { menuItemId: 'm50', name: 'Sinigang na Baboy', quantity: 1, category: 'Native Dishes' },
      { menuItemId: 'm16', name: 'Sizzling Sisig', quantity: 1, category: 'Sizzling' },
      { menuItemId: 'm75', name: 'Leche Plan', quantity: 2, category: 'Desserts' },
      { menuItemId: 'm40', name: 'Mango Juice', quantity: 2, category: 'Beverages' },
    ],
  },
  {
    id: 'TKT-004',
    orderId: 'ORD-J1K2L3',
    tableLabel: 'Counter #2',
    source: 'pos',
    status: 'preparing',
    receivedAt: new Date(now - 2 * 60 * 1000),
    items: [
      { menuItemId: 'm51', name: 'Kare Kare', quantity: 1, category: 'Native Dishes' },
      { menuItemId: 'm9', name: 'Lumpiang Shanghai', quantity: 2, category: 'Dry Dishes' },
      { menuItemId: 'm39', name: 'Pineapple Juice', quantity: 2, category: 'Beverages' },
    ],
  },
];
  return sortByReceived(demo.map(toTicket));
}

const POS_ITEMS: TicketItem[][] = [
  [
    { menuItemId: 'm4', name: 'Sotanghon Soup', quantity: 1, category: 'Soup' },
    { menuItemId: 'm47', name: 'Beef Fried Rice', quantity: 2, category: 'Rice' },
  ],
  [
    { menuItemId: 'm74', name: 'Buko Salad', quantity: 2, category: 'Desserts' },
    { menuItemId: 'm40', name: 'Mango Juice', quantity: 2, category: 'Beverages' },
  ],
];

// ─── Store (Angular service) ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class KitchenStore {
  private platformId = inject(PLATFORM_ID);
  private menu = inject(MenuStore);
  private posIdx = 0;
  private stockOverrides = signal<Record<string, boolean>>({});

  readonly tickets = signal<KitchenTicket[]>(seedTickets());

  readonly stock = computed<StockEntry[]>(() =>
  this.menu.items().map(m => ({
    menuItemId: m.id,
    name: m.name,
    category: m.category,
    available: this.stockOverrides()[m.id] ?? m.available,
  })),
);

  // Simulated hourly order counts (last 12 hours, rolling), was `export let hourlyCounts`
  readonly hourlyCounts = signal<number[]>([2, 4, 7, 12, 18, 22, 15, 9, 14, 20, 17, 11]);

  constructor() {
    // Simulate incoming POS order every ~45s (browser only, so the server doesn't run a timer forever)
    if (isPlatformBrowser(this.platformId)) {
      setInterval(() => this.simulatePosOrder(), 45000);
    }
  }

  // ─── Ticket actions ─────────────────────────────────────────────────────────

  addTicket(t: NewTicket) {
    this.tickets.update(list => sortByReceived([toTicket(t), ...list]));
    this.hourlyCounts.update(h => [...h.slice(1), h[h.length - 1] + 1]);
  }

  advanceTicket(ticketId: string) {
    this.tickets.update(list =>
      list.map(t => {
        if (t.id !== ticketId) return t;
        const next: TicketStatus = t.status === 'preparing' ? 'ready' : 'served';
        return {
          ...t,
          status: next,
          statusHistory: [...t.statusHistory, { status: next, at: new Date() }],
        };
      }),
    );
  }

  // ─── Stock actions ──────────────────────────────────────────────────────────

async setAvailable(menuItemId: string, available: boolean) {
  const prev = this.stockOverrides()[menuItemId];
  this.stockOverrides.update(o => ({ ...o, [menuItemId]: available }));
  try {
    await this.menu.setAvailable(menuItemId, available);
  } catch (e) {
    console.error('Stock update failed:', e);
    this.stockOverrides.update(o => {
      const { [menuItemId]: _, ...rest } = o;
      return prev === undefined ? rest : { ...rest, [menuItemId]: prev };
    });
  }
}
  isAvailable(menuItemId: string): boolean {
    return this.stock().find(s => s.menuItemId === menuItemId)?.available ?? true;
  }

  // ─── Demo simulator ─────────────────────────────────────────────────────────

  private simulatePosOrder() {
    const items = POS_ITEMS[this.posIdx % POS_ITEMS.length];
    this.posIdx++;
    this.addTicket({
      id: `TKT-POS-${Date.now()}`,
      orderId: `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      tableLabel: this.posIdx % 2 === 0 ? 'Counter #1' : 'Counter #2',
      source: 'pos',
      status: 'preparing',
      receivedAt: new Date(),
      items,
    });
  }
}