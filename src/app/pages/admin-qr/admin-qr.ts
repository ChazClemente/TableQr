import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { TableDto, TableService } from '../../services/table.service';

interface Table {
  id: string;
  label: string;
  token: string;
  url: string;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
}

function toTable(d: TableDto): Table {
  return {
    id: d.id,
    label: d.label,
    token: d.token,
    url: d.url,
    createdAt: new Date(d.createdAt),
    expiresAt: new Date(d.expiresAt),
    active: d.active,
  };
}

@Component({
  selector: 'app-admin-qr',
  imports: [FormsModule],
  templateUrl: './admin-qr.html',
})
export class AdminQr {
  private api = inject(TableService);

  tables = signal<Table[]>([]);
  selectedId = signal<string | null>(null);
  newLabel = signal('');
  showAddForm = signal(false);
  qrDataUrl = signal('');

  labelInput = viewChild<ElementRef<HTMLInputElement>>('labelInput');

  selectedTable = computed(() => this.tables().find(t => t.id === this.selectedId()) ?? null);

  // URL galing mismo sa database (session_link)
  selectedUrl = computed(() => this.selectedTable()?.url ?? '');
  nextLabel = computed(() => {
  const nums = this.tables()
    .map(t => Number(t.label.replace(/\D/g, '')))
    .filter(n => Number.isFinite(n) && n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `Table ${next}`;
});

  stats = computed(() => {
    const list = this.tables();
    return [
      { label: 'Total Tables', value: list.length },
      { label: 'Active Sessions', value: list.filter(t => t.active).length },
      { label: 'Inactive', value: list.filter(t => !t.active).length },
      { label: 'Session Duration', value: '4 hrs' },
    ];
  });

  constructor() {
    // regenerate QR image whenever the selected table / token changes
    effect(() => {
      const url = this.selectedUrl();
      if (!url) {
        this.qrDataUrl.set('');
        return;
      }
      QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        width: 180,
        margin: 0,
        color: { dark: '#2C1810', light: '#FFF8EE' },
      }).then(data => {
        if (url === this.selectedUrl()) this.qrDataUrl.set(data);
      });
    });

    // autofocus the input when the add form opens
    effect(() => {
      this.labelInput()?.nativeElement.focus();
    });

    this.load();
  }

  private fail(msg: string, err?: unknown) {
    console.error(msg, err);
    alert(msg);
  }

  load() {
    this.api.list().subscribe({
      next: list => {
        const tables = list.map(toTable);
        this.tables.set(tables);
        const current = this.selectedId();
        if (!current || !tables.some(t => t.id === current)) {
          this.selectedId.set(tables[0]?.id ?? null);
        }
      },
      error: err => this.fail('Hindi ma-load ang tables mula sa Supabase.', err),
    });
  }

  private replace(updated: Table) {
    this.tables.update(list => list.map(t => (t.id === updated.id ? updated : t)));
  }

  toggleAddForm() {
      this.showAddForm.update(v => !v);
    }

  selectTable(id: string) {
    this.selectedId.set(id);
  }

  addTable() {
  const label = this.nextLabel();
  this.api.add(label).subscribe({
    next: d => {
      const table = toTable(d);
      this.tables.update(list => [...list, table]);
      this.selectedId.set(table.id);
      this.showAddForm.set(false);
    },
    error: err => this.fail('Hindi nagawa ang table.', err),
  });
}

  regenerateToken(tableId: string) {
    this.api.regenerate(tableId).subscribe({
      next: d => this.replace(toTable(d)),
      error: err => this.fail('Hindi na-regenerate ang QR.', err),
    });
  }

  toggleActive(tableId: string) {
    this.api.toggle(tableId).subscribe({
      next: d => this.replace(toTable(d)),
      error: err => this.fail('Hindi na-update ang status.', err),
    });
  }

  formatTime(date: Date) {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  print() {
    window.print();
  }
}