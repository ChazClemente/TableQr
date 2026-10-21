import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  'Pampagana':     { min: 5,  max: 10 },
  'Sabaw':         { min: 12, max: 20 },
  'Ulam':          { min: 15, max: 25 },
  'Kanin & Pansit':{ min: 8,  max: 12 },
  'Merienda':      { min: 3,  max: 7  },
  'Inumin':        { min: 1,  max: 3  },
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
        { menuItemId: 'm4', name: 'Bulalo Batangas', quantity: 1, category: 'Sabaw' },
        { menuItemId: 'm7', name: 'Adobong Puti', quantity: 2, category: 'Ulam' },
        { menuItemId: 'm11', name: 'Sinangag at Itlog', quantity: 2, category: 'Kanin & Pansit' },
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
        { menuItemId: 'm1', name: 'Bagnet Chicharon', quantity: 1, category: 'Pampagana' },
        { menuItemId: 'm12', name: 'Pansit Bihon Guisado', quantity: 1, category: 'Kanin & Pansit' },
        { menuItemId: 'm17', name: 'Salabat', quantity: 2, category: 'Inumin' },
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
        { menuItemId: 'm5', name: 'Sinigang na Bangus', quantity: 1, category: 'Sabaw' },
        { menuItemId: 'm10', name: 'Pinakbet Ilocos', quantity: 1, category: 'Ulam' },
        { menuItemId: 'm14', name: 'Halo-Halo', quantity: 2, category: 'Merienda' },
        { menuItemId: 'm18', name: 'Buko Juice', quantity: 2, category: 'Inumin' },
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
        { menuItemId: 'm8', name: 'Kare-Kare', quantity: 1, category: 'Ulam' },
        { menuItemId: 'm2', name: 'Empanada Vigan', quantity: 2, category: 'Pampagana' },
        { menuItemId: 'm19', name: "Sago't Gulaman", quantity: 2, category: 'Inumin' },
      ],
    },
  ];
  return sortByReceived(demo.map(toTicket));
}

// Demo orders used by the fake POS simulator
const POS_ITEMS: TicketItem[][] = [
  [
    { menuItemId: 'm6', name: 'Tinola na Manok', quantity: 1, category: 'Sabaw' },
    { menuItemId: 'm13', name: 'Arroz Caldo', quantity: 2, category: 'Kanin & Pansit' },
  ],
  [
    { menuItemId: 'm15', name: 'Bibingka', quantity: 2, category: 'Merienda' },
    { menuItemId: 'm18', name: 'Buko Juice', quantity: 2, category: 'Inumin' },
  ],
];

// ─── Store (Angular service) ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class KitchenStore {
  private platformId = inject(PLATFORM_ID);
  private posIdx = 0;

  readonly tickets = signal<KitchenTicket[]>(seedTickets());

  readonly stock = signal<StockEntry[]>(
      [].map((m: any) => ({
      menuItemId: m.id,
      name: m.name,
      category: m.category,
      available: m.available,
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

  setAvailable(menuItemId: string, available: boolean) {
    this.stock.update(list =>
      list.map(s =>
        s.menuItemId === menuItemId
          ? { ...s, available, markedUnavailableAt: !available ? new Date() : undefined }
          : s,
      ),
    );
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