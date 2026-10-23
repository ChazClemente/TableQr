import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../../store/supabase.service';
import { TableService } from '../../../services/table.service'; // <-- ayusin ang path kung iba
 
type FloorStatus = 'available' | 'reserved' | 'dirty';
type TableStatus = FloorStatus | 'occupied';
 
interface FloorTable {
  id: number; // table_id sa database
  code: string; // 'T01' (ginagamit ng TableService)
  label: string; // table_number (halimbawa "Table 3")
  seats: number;
  x: number;
  y: number;
  w: number;
  h: number;
  floorStatus: FloorStatus;
  status: TableStatus; // occupied = computed mula sa bukas na bill
  reservedFor: string | null;
  active: boolean; // QR session active?
}
 
interface OpenBill {
  id: number;
  tableId: number;
  tableLabel: string;
  total: number;
}
 
const STATUS_META: Record<TableStatus, { bg: string; border: string; text: string; dot: string; label: string }> = {
  available: { bg: '#4A7C5918', border: '#4A7C59', text: '#4A7C59', dot: '#4A7C59', label: 'Available' },
  occupied:  { bg: '#7A3B1E18', border: '#7A3B1E', text: '#7A3B1E', dot: '#7A3B1E', label: 'Occupied' },
  reserved:  { bg: '#D4A84318', border: '#D4A843', text: '#8B6914', dot: '#D4A843', label: 'Reserved' },
  dirty:     { bg: '#C0392B12', border: '#C0392B', text: '#C0392B', dot: '#C0392B', label: 'Needs Clearing' },
};
const STATUS_KEYS = Object.keys(STATUS_META) as TableStatus[];
const PICK_KEYS: FloorStatus[] = ['available', 'reserved', 'dirty'];
 
const CANVAS_W = 536;
const CANVAS_H = 760;
const WALL = 28;
const OPEN_BILL_HOURS = 12; // ang unpaid na bill na mas luma rito ay hindi na binibilang
 
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const msg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as any).message) : fallback;
 
@Component({
  selector: 'app-floor-map',
  imports: [FormsModule],
  templateUrl: './floor-map.html',
})
export class FloorMap {
  meta = STATUS_META;
  statusKeys = STATUS_KEYS;
  pickKeys = PICK_KEYS;
  canvasW = CANVAS_W;
  canvasH = CANVAS_H;
  wall = WALL;
 
  private db = inject(SupabaseService).client;
  private tableSvc = inject(TableService);
  private destroyRef = inject(DestroyRef);
  private reloadTimer = 0;
 
  tables = signal<FloorTable[]>([]);
  openBills = signal<OpenBill[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  editMode = signal(false);
  selected = signal<number | null>(null);
  statusTarget = signal<number | null>(null);
  reserveName = signal('');
 
  private savedTables: FloorTable[] = [];
  private dragging: { id: number; startX: number; startY: number; origX: number; origY: number } | null = null;
 
  selectedTable = computed(() => this.tables().find((t) => t.id === this.selected()));
  statusTable = computed(() => this.tables().find((t) => t.id === this.statusTarget()));
 
  constructor() {
    // Live: kapag may nagbago sa bill, order, mesa o floor
    const channel = this.db.channel('floor-live');
    for (const table of ['bill', 'orders', 'tables', 'table_floor']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.scheduleReload());
    }
    channel.subscribe();
    this.destroyRef.onDestroy(() => {
      window.clearTimeout(this.reloadTimer);
      this.db.removeChannel(channel);
    });
    void this.load();
  }
 
  private scheduleReload() {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => {
      if (!this.dragging) void this.load();
    }, 400);
  }
 
  async load(): Promise<void> {
    try {
      const [dtos, floor, bills] = await Promise.all([
        firstValueFrom(this.tableSvc.list()),
        this.db.from('table_floor').select('*'),
        this.db
          .from('bill')
          .select('bill_id,total_amount,orders(table_id,created_at)')
          .eq('bill_status', 'unpaid'),
      ]);
      if (floor.error) throw floor.error;
      if (bills.error) throw bills.error;
 
      const floorById = new Map<number, any>((floor.data ?? []).map((f: any) => [f.table_id, f]));
      const since = Date.now() - OPEN_BILL_HOURS * 3600_000;
      const openRaw: { id: number; tableId: number; total: number }[] = [];
      for (const b of (bills.data ?? []) as any[]) {
        const o = one<any>(b.orders);
        if (!o || o.table_id == null) continue;
        if (new Date(o.created_at).getTime() < since) continue;
        openRaw.push({ id: b.bill_id, tableId: Number(o.table_id), total: Number(b.total_amount) });
      }
 
      const editing = this.editMode();
      const prev = new Map(this.tables().map((t) => [t.id, t]));
 
      const next: FloorTable[] = dtos.map((d, i) => {
        const id = Number(d.id.replace(/\D/g, ''));
        const f = floorById.get(id);
        const p = editing ? prev.get(id) : undefined; // huwag mabura ang inaayos sa edit mode
        const col = i % 4;
        const row = Math.floor(i / 4);
        const floorStatus = (f?.floor_status ?? 'available') as FloorStatus;
        return {
          id,
          code: d.id,
          label: d.label,
          seats: p?.seats ?? f?.seats ?? 4,
          x: p?.x ?? f?.pos_x ?? 38 + col * 125,
          y: p?.y ?? f?.pos_y ?? 60 + row * 92,
          w: p?.w ?? f?.w ?? 105,
          h: p?.h ?? f?.h ?? 64,
          floorStatus,
          status: openRaw.some((b) => b.tableId === id) ? 'occupied' : floorStatus,
          reservedFor: f?.reserved_for ?? null,
          active: d.active,
        };
      });
 
      const labelById = new Map(next.map((t) => [t.id, t.label]));
      this.tables.set(next);
      this.openBills.set(openRaw.map((b) => ({ ...b, tableLabel: labelById.get(b.tableId) ?? 'Table ' + b.tableId })));
      this.error.set('');
    } catch (e) {
      this.error.set(msg(e, 'Unable to load the floor map.'));
    } finally {
      this.loading.set(false);
    }
  }
 
  billFor(t: FloorTable) {
    return this.openBills().find((b) => b.tableId === t.id);
  }
 
  count(status: TableStatus) {
    return this.tables().filter((t) => t.status === status).length;
  }
 
  // --- Drag ---
  onTableMouseDown(e: MouseEvent, table: FloorTable) {
    if (this.editMode()) {
      e.preventDefault();
      this.dragging = { id: table.id, startX: e.clientX, startY: e.clientY, origX: table.x, origY: table.y };
      this.selected.set(table.id);
    } else {
      this.statusTarget.set(this.statusTarget() === table.id ? null : table.id);
      this.selected.set(table.id);
      this.reserveName.set('');
    }
  }
 
  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.dragging) return;
    const { id, startX, startY, origX, origY } = this.dragging;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    this.tables.update((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        const nx = Math.max(4, Math.min(CANVAS_W - t.w - 4, origX + dx));
        const ny = Math.max(4, Math.min(CANVAS_H - t.h - 4, origY + dy));
        return { ...t, x: Math.round(nx), y: Math.round(ny) };
      }),
    );
  }
 
  @HostListener('window:mouseup')
  onMouseUp() {
    this.dragging = null;
  }
 
  // --- Edit mode ---
  startEdit() {
    this.savedTables = this.tables().map((t) => ({ ...t }));
    this.statusTarget.set(null);
    this.editMode.set(true);
  }
 
  cancelEdit() {
    this.tables.set(this.savedTables);
    this.editMode.set(false);
    this.selected.set(null);
  }
 
  async saveLayout() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const rows = this.tables().map((t) => ({
        table_id: t.id,
        seats: t.seats,
        pos_x: t.x,
        pos_y: t.y,
        w: t.w,
        h: t.h,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await this.db.from('table_floor').upsert(rows, { onConflict: 'table_id' });
      if (error) throw error;
      this.editMode.set(false);
      this.selected.set(null);
      await this.load();
    } catch (e) {
      this.error.set(msg(e, 'Unable to save the layout.'));
    } finally {
      this.busy.set(false);
    }
  }
 
  /** Gumagawa ng totoong mesa + QR (parehong galing sa Admin QR). */
  async addTable() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const nums = this.tables().map((t) => Number(t.label.replace(/\D/g, '')) || 0);
      const label = `Table ${Math.max(0, ...nums) + 1}`;
      await firstValueFrom(this.tableSvc.add(label));
      await this.load();
    } catch (e) {
      this.error.set(msg(e, 'Unable to add the table.'));
    } finally {
      this.busy.set(false);
    }
  }
 
  updateSeats(id: number, seats: number) {
    this.tables.update((list) => list.map((t) => (t.id === id ? { ...t, seats } : t)));
  }
 
  // --- Status ---
  /**
   * Occupied = awtomatiko (may unpaid na bill), hindi ito mababago nang manual.
   * Needs Clearing = awtomatiko kapag nabayaran ang bill.
   * Reserved / Available(Cleared) = manual ng staff, kasama ang QR side-effects.
   */
  async setStatus(t: FloorTable, key: FloorStatus) {
    if (this.busy() || t.status === 'occupied') return;
    this.busy.set(true);
    this.error.set('');
    try {
      const prev = t.floorStatus;
      const reservedFor = key === 'reserved' ? this.reserveName().trim() || null : null;
      const { error } = await this.db.from('table_floor').upsert(
        {
          table_id: t.id,
          floor_status: key,
          reserved_for: reservedFor,
          reserved_at: key === 'reserved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'table_id' },
      );
      if (error) throw error;
 
      // QR: reserved -> i-deactivate ang QR; available -> i-activate, at bagong session kung galing sa dirty
      if (key === 'reserved' && t.active) await firstValueFrom(this.tableSvc.toggle(t.code));
      if (key === 'available') {
        if (!t.active) await firstValueFrom(this.tableSvc.toggle(t.code));
        if (prev === 'dirty') await firstValueFrom(this.tableSvc.regenerate(t.code));
      }
 
      this.statusTarget.set(null);
      this.selected.set(null);
      this.reserveName.set('');
      await this.load();
    } catch (e) {
      this.error.set(msg(e, 'Unable to update the table status.'));
    } finally {
      this.busy.set(false);
    }
  }
}
