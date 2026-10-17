import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { CashierStore } from '../../../store/cashier-store';

type ClosingState = 'idle' | 'counting';

@Component({
  selector: 'app-day-closing',
  imports: [CashierLayout, DatePipe],
  templateUrl: './day-closing.html',
})
export class DayClosing {
  private store = inject(CashierStore);

  cashDrawer = this.store.cashDrawer;
  summary = this.store.dailySummary;
  closing = this.store.todayClosing; // the saved closing for today (or null)

  state = signal<ClosingState>('idle');
  // once today is closed, always show the saved report
  view = computed<'idle' | 'counting' | 'report'>(() => (this.closing() ? 'report' : this.state()));

  actualCash = signal('');
  saving = signal(false);
  error = signal<string | null>(null);
  today = new Date();

  reportRef = viewChild<ElementRef<HTMLDivElement>>('reportRef');

  openBills = computed(() => this.store.bills().filter(b => b.status === 'open').length);

  actualNum = computed(() => parseFloat(this.actualCash()) || 0);
  canClose = computed(() => this.actualCash().trim() !== '' && this.actualNum() >= 0);

  // live numbers while counting
  discrepancy = computed(() => this.actualNum() - this.summary().expectedDrawer);
  hasDiscrepancy = computed(() => Math.abs(this.discrepancy()) > 0.5);
  discrepancyColor = computed(() => {
    if (!this.hasDiscrepancy()) return '#4A7C59';
    return this.discrepancy() < 0 ? '#C0392B' : '#8B6914';
  });

  // saved numbers in the report
  reportFlag = computed(() => Math.abs(this.closing()?.discrepancy ?? 0) > 0.5);
  reportColor = computed(() => {
    const d = this.closing()?.discrepancy ?? 0;
    if (Math.abs(d) <= 0.5) return '#4A7C59';
    return d < 0 ? '#C0392B' : '#8B6914';
  });

  // the 4 cards at the top
  cards = computed(() => {
    const s = this.summary();
    return [
      { label: 'Total Sales', value: `₱${s.totalSales.toLocaleString()}`, color: '#7A3B1E' },
      { label: 'Cash Sales', value: `₱${s.totalCash.toLocaleString()}`, color: '#5C2E0A' },
      { label: 'E-Wallet Sales', value: `₱${s.totalEwallet.toLocaleString()}`, color: '#4A7C59' },
      { label: 'Discounts Given', value: `₱${s.totalDiscounts.toLocaleString()}`, color: '#D4A843' },
    ];
  });

  // rows at the top of the closing report
  reportRows = computed(() => {
    const c = this.closing();
    if (!c) return [];
    const m = (n: number) => `₱${n.toLocaleString()}`;
    return [
      ['Total Transactions', String(c.totalTransactions)],
      ['Gross Sales', m(c.grossSales)],
      ['Discounts Given', `−${m(c.totalDiscounts)}`],
      ['Service Charge', m(c.serviceCharges)],
      ['Net Sales', m(c.netSales)],
    ];
  });

  constructor() {
    // refresh when the page opens, so the numbers are current
    this.store.loadTransactions();
    this.store.loadCashDrawer();
    this.store.loadClosings();
  }

  onActualCash(e: Event) {
    this.actualCash.set((e.target as HTMLInputElement).value);
  }

  async closeDay() {
    if (!this.canClose() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.store.closeDay(this.actualNum());
    } catch (e: any) {
      console.error(e);
      this.error.set(
        e?.message?.includes('already closed') ? 'Today is already closed.' : 'Could not close the day. Please try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  handlePrintReport() {
    const el = this.reportRef()?.nativeElement;
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Day Close Report</title>
      <style>body{font-family:monospace;font-size:12px;width:360px;margin:0 auto;padding:16px;color:#2C1810;}</style>
      </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  }
}