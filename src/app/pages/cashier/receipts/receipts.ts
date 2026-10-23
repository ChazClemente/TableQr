import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { MiniCalendar } from '../../../components/mini-calendar/mini-calendar';
import { ReceiptView } from '../../../components/receipt-view/receipt-view';
import { CashierStore, type Transaction } from '../../../store/cashier-store';

@Component({
  selector: 'app-receipts',
  imports: [CashierLayout, MiniCalendar, ReceiptView, DatePipe],
  templateUrl: './receipts.html',
})
export class Receipts {
  private store = inject(CashierStore);
  
  search = signal('');
  selectedId = signal<string | null>(null);
  filterDate = signal<string | null>(null);

  allTxns = computed(() => this.store.transactions());
  
  activeDates = computed(() => {
    const dates = new Set<string>();
    this.allTxns().forEach(t => {
      dates.add(t.settledAt.toLocaleDateString('en-CA'));
    });
    return dates;
  });

  selected = computed(() => this.filtered().find(t => t.id === this.selectedId()) ?? null);
  hasFilters = computed(() => !!this.search() || !!this.filterDate());

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const d = this.filterDate();

    return this.allTxns().filter(t => {
      if (d && t.settledAt.toLocaleDateString('en-CA') !== d) return false;

      if (!q) return true;
      if (t.id.toLowerCase().includes(q)) return true;
      if (t.paymentMethod.toLowerCase().includes(q)) return true;
      if (t.orderType.toLowerCase().includes(q)) return true;
      if (t.items.some(i => i.name.toLowerCase().includes(q))) return true;

      return false;
    });
  });

  onSearch(e: Event) {
    this.search.set((e.target as HTMLInputElement).value);
  }

  clearSearch() {
    this.search.set('');
  }

  onDateSelect(date: string | null) {
    this.filterDate.set(date);
  }

  handlePrint() {
    window.print();
  }
}