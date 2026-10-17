import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { MiniCalendar, toDateKey } from '../../../components/mini-calendar/mini-calendar';
import { ReceiptView } from '../../../components/receipt-view/receipt-view';
import { CashierStore } from '../../../store/cashier-store';


@Component({
  selector: 'app-receipts',
  imports: [CashierLayout, MiniCalendar, ReceiptView, DatePipe],
  templateUrl: './receipts.html',
})
export class Receipts {
  private store = inject(CashierStore);

  transactions = this.store.transactions;

  selectedId = signal<string | null>(null);
  filterDate = signal('');
  search = signal('');

  printRef = viewChild<ElementRef<HTMLDivElement>>('printRef');

  activeDates = computed(() => new Set(this.transactions().map(t => toDateKey(t.settledAt))));

  filtered = computed(() => {
    let list = this.transactions();
    const date = this.filterDate();
    const q = this.search().trim().toLowerCase();

    if (date) list = list.filter(t => toDateKey(t.settledAt) === date);
    if (q) {
      list = list.filter(
        t =>
          t.id.toLowerCase().includes(q) ||
          (t.tableLabel ?? '').toLowerCase().includes(q) ||
          t.orderType.toLowerCase().includes(q) ||
          t.paymentMethod.toLowerCase().includes(q) ||
          t.cashier.toLowerCase().includes(q) ||
          t.items.some(i => i.name.toLowerCase().includes(q)) ||
          (t.discount?.customerName ?? '').toLowerCase().includes(q) ||
          (t.discount?.idNumber ?? '').toLowerCase().includes(q) ||
          String(t.total).includes(q),
      );
    }
    return list;
  });

  selected = computed(
    () =>
      this.filtered().find(t => t.id === this.selectedId()) ??
      this.transactions().find(t => t.id === this.selectedId()) ??
      null,
  );

  hasFilters = computed(() => !!this.filterDate() || !!this.search().trim());

    constructor() {
    // refresh from the database every time the page opens
    this.store.loadTransactions();

    // receipts load async, so pick the first one when they arrive
    effect(() => {
      const first = this.filtered()[0];
      if (this.selectedId() === null && first) this.selectedId.set(first.id);
    });
  }


  onSearch(e: Event) {
    this.search.set((e.target as HTMLInputElement).value);
    this.selectedId.set(null);
  }

  clearSearch() {
    this.search.set('');
  }

  onDateSelect(key: string) {
    this.filterDate.set(key);
    this.selectedId.set(null);
  }

  handlePrint() {
    const el = this.printRef()?.nativeElement;
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt — ${this.selected()?.id}</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 16px; color: #2C1810; }
        * { box-sizing: border-box; }
      </style></head><body>
      ${el.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  }
}