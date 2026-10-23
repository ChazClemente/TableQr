import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CashierStore } from '../../../store/cashier-store';
import { addAuditEvent } from '../../..//store/user-store';

type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';

interface FloorTable {
  id: string;
  label: string;
  seats: number;
  x: number; // px within canvas
  y: number;
  w: number;
  h: number;
  status: TableStatus;
}

const STATUS_META: Record<TableStatus, { bg: string; border: string; text: string; dot: string; label: string }> = {
  available: { bg: '#4A7C5918', border: '#4A7C59',   text: '#4A7C59', dot: '#4A7C59', label: 'Available'      },
  occupied:  { bg: '#7A3B1E18', border: '#7A3B1E',   text: '#7A3B1E', dot: '#7A3B1E', label: 'Occupied'       },
  reserved:  { bg: '#D4A84318', border: '#D4A843',   text: '#8B6914', dot: '#D4A843', label: 'Reserved'       },
  dirty:     { bg: '#C0392B12', border: '#C0392B',   text: '#C0392B', dot: '#C0392B', label: 'Needs Clearing' },
};
const STATUS_KEYS = Object.keys(STATUS_META) as TableStatus[];

// Initial layout matching the reference floor plan (canvas 560×780)
const INITIAL_TABLES: FloorTable[] = [
  // Row 1
  { id: 't1',  label: 'T1',  seats: 2, x: 38,  y: 270, w: 80,  h: 60,  status: 'available' },
  { id: 't2',  label: 'T2',  seats: 4, x: 148, y: 270, w: 105, h: 60,  status: 'available' },
  { id: 't3',  label: 'T3',  seats: 4, x: 283, y: 270, w: 105, h: 60,  status: 'available' },
  { id: 't4',  label: 'T4',  seats: 2, x: 418, y: 270, w: 80,  h: 60,  status: 'available' },
  // Row 2
  { id: 't5',  label: 'T5',  seats: 2, x: 38,  y: 358, w: 80,  h: 72,  status: 'available' },
  { id: 't6',  label: 'T6',  seats: 4, x: 148, y: 358, w: 105, h: 72,  status: 'available' },
  { id: 't7',  label: 'T7',  seats: 4, x: 283, y: 358, w: 105, h: 72,  status: 'available' },
  { id: 't8',  label: 'T8',  seats: 2, x: 418, y: 358, w: 80,  h: 72,  status: 'available' },
  // Row 3
  { id: 't9',  label: 'T9',  seats: 2, x: 38,  y: 460, w: 80,  h: 72,  status: 'available' },
  { id: 't10', label: 'T10', seats: 4, x: 148, y: 460, w: 105, h: 72,  status: 'available' },
  { id: 't11', label: 'T11', seats: 4, x: 283, y: 460, w: 105, h: 72,  status: 'available' },
  { id: 't12', label: 'T12', seats: 2, x: 418, y: 460, w: 80,  h: 72,  status: 'available' },
  // Row 4
  { id: 't13', label: 'T13', seats: 4, x: 110, y: 562, w: 105, h: 60,  status: 'available' },
  { id: 't14', label: 'T14', seats: 4, x: 245, y: 562, w: 105, h: 60,  status: 'available' },
  { id: 't15', label: 'T15', seats: 2, x: 390, y: 562, w: 80,  h: 60,  status: 'available' },
];

const CANVAS_W = 536;
const CANVAS_H = 760;
const WALL = 28; // wall thickness in px

let nextIdNum = 16;

@Component({
  selector: 'app-floor-map',
  imports: [RouterLink, FormsModule],
  templateUrl: './floor-map.html',
})
export class FloorMap {
  meta = STATUS_META;
  statusKeys = STATUS_KEYS;
  canvasW = CANVAS_W;
  canvasH = CANVAS_H;
  wall = WALL;
  private cashier = inject(CashierStore);

  tables: FloorTable[] = (() => {
  const occupiedLabels = new Set(
    this.cashier.bills().filter(b => b.status === 'open' && b.tableLabel).map(b => b.tableLabel!)
  );
  return INITIAL_TABLES.map(t =>
    occupiedLabels.has(t.label) ? { ...t, status: 'occupied' as TableStatus } : t
  );
})();

  editMode = false;
  savedTables: FloorTable[] = INITIAL_TABLES;
  selected: string | null = null;
  statusTarget: string | null = null;

  // Drag state
  private dragging: { id: string; startX: number; startY: number; origX: number; origY: number } | null = null;

  get openBills() { return this.cashier.bills().filter(b => b.status === 'open'); }
  get selectedTable() { return this.tables.find(t => t.id === this.selected); }
  get statusTable() { return this.tables.find(t => t.id === this.statusTarget); }

  getBillForTable(label: string) {
    return this.openBills.find(b => b.tableLabel === label);
  }

  count(status: TableStatus) { return this.tables.filter(t => t.status === status).length; }

  // --- Drag handlers ---
  onTableMouseDown(e: MouseEvent, table: FloorTable) {
    if (this.editMode) {
      e.preventDefault();
      this.dragging = { id: table.id, startX: e.clientX, startY: e.clientY, origX: table.x, origY: table.y };
      this.selected = table.id;
    } else {
      this.statusTarget = this.statusTarget === table.id ? null : table.id;
      this.selected = table.id;
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.dragging) return;
    const { id, startX, startY, origX, origY } = this.dragging;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    this.tables = this.tables.map(t => {
      if (t.id !== id) return t;
      const nx = Math.max(4, Math.min(CANVAS_W - t.w - 4, origX + dx));
      const ny = Math.max(4, Math.min(CANVAS_H - t.h - 4, origY + dy));
      return { ...t, x: Math.round(nx), y: Math.round(ny) };
    });
  }

  @HostListener('window:mouseup')
  onMouseUp() { this.dragging = null; }

  // --- Actions ---
  addTable() {
    const id = `t${nextIdNum++}`;
    const label = `T${nextIdNum - 1}`;
    this.tables = [...this.tables, { id, label, seats: 4, x: 200, y: 150, w: 100, h: 70, status: 'available' }];
  }

  removeSelected() {
    if (!this.selected) return;
    this.tables = this.tables.filter(t => t.id !== this.selected);
    this.selected = null;
  }

  saveLayout() {
    this.savedTables = this.tables;
    this.editMode = false;
    this.selected = null;
    addAuditEvent({ action: 'table_reassigned', userId: 'U01', userName: 'Nene Reyes', detail: 'Floor layout saved', severity: 'info' });
  }

  cancelEdit() {
    this.tables = this.savedTables;
    this.editMode = false;
    this.selected = null;
  }

  setStatus(id: string, status: TableStatus) {
    this.tables = this.tables.map(t => t.id === id ? { ...t, status } : t);
    this.statusTarget = null;
    this.selected = null;
  }

  updateLabel(id: string, label: string) {
    this.tables = this.tables.map(t => t.id === id ? { ...t, label } : t);
  }

  updateSeats(id: string, seats: number) {
    this.tables = this.tables.map(t => t.id === id ? { ...t, seats } : t);
  }
}