import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { CashierStore } from '../../../store/cashier-store';
import type { DayClosing as DayClosingReport } from '../../../store/cashier-store';

@Component({
  selector: 'app-day-closing',
  imports: [CashierLayout, DatePipe],
  templateUrl: './day-closing.html',
})
export class DayClosingComponent {
  store = inject(CashierStore);
  today = new Date();

  viewMode = signal<'today' | 'history'>('today');
  state = signal<'idle' | 'counting' | 'report'>('idle');
  saving = signal(false);
  error = signal<string | null>(null);
  actualCash = signal('');
  showConfirmModal = signal(false);

  cashDrawer = this.store.cashDrawer;
  summary = this.store.dailySummary;
  closing = this.store.todayClosing;
  
  openBills = computed(() => this.store.bills().filter(b => b.status === 'open').length);
  pastClosings = computed(() => this.store.closings().filter(c => c.businessDate !== new Date().toLocaleDateString('en-CA')));
  selectedPastReport = signal<DayClosingReport | null>(null);

  cards = computed(() => {
    const s = this.summary();
    return [
      { label: 'Transactions', value: s.todayTxns.length, color: '#2C1810' },
      { label: 'Gross Sales', value: `₱${s.totalSales.toLocaleString()}`, color: '#7A3B1E' },
      { label: 'Cash Sales', value: `₱${s.totalCash.toLocaleString()}`, color: '#4A7C59' },
      { label: 'E-Wallet', value: `₱${s.totalEwallet.toLocaleString()}`, color: '#1E3A8A' },
    ];
  });

  actualNum = computed(() => parseFloat(this.actualCash()) || 0);
  canClose = computed(() => this.actualNum() > 0);
  hasDiscrepancy = computed(() => this.canClose() && this.discrepancy() !== 0);
  
  discrepancy = computed(() => {
    if (!this.canClose()) return 0;
    return this.actualNum() - this.summary().expectedDrawer;
  });

  discrepancyColor = computed(() => {
    if (!this.hasDiscrepancy()) return '#4A7C59';
    return this.discrepancy() < 0 ? '#C0392B' : '#D4A843';
  });

  reportColor = computed(() => {
    const c = this.closing();
    if (!c) return '#2C1810';
    return c.discrepancy === 0 ? '#4A7C59' : '#C0392B';
  });

  reportFlag = computed(() => {
    const c = this.closing();
    return c ? c.discrepancy !== 0 : false;
  });

  reportRows = computed(() => {
    const c = this.closing();
    if (!c) return [];
    return [
      ['Total Transactions', c.totalTransactions],
      ['Gross Sales', `₱${c.grossSales.toLocaleString()}`],
      ['Total Discounts', `-₱${c.totalDiscounts.toLocaleString()}`],
      ['Net Sales', `₱${c.netSales.toLocaleString()}`],
      ['Service Charges', `₱${c.serviceCharges.toLocaleString()}`],
    ];
  });

  constructor() {
    this.store.loadClosings().then(() => {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const alreadyClosed = this.store.closings().find(c => c.businessDate === todayStr);
      
      if (alreadyClosed) {
        this.state.set('report');
      }
    });
  }

  onActualCash(e: Event) {
    this.actualCash.set((e.target as HTMLInputElement).value);
  }

  initiateCloseDay() {
    if (!this.canClose()) return;
    this.showConfirmModal.set(true);
  }

  cancelCloseDay() {
    this.showConfirmModal.set(false);
  }

  async confirmCloseDay() {
    this.showConfirmModal.set(false);
    this.saving.set(true);
    this.error.set(null);
    
    try {
      await this.store.closeDay(this.actualNum());
      this.state.set('report');
    } catch (e: any) {
      this.error.set(e.message || 'Could not close the day.');
    } finally {
      this.saving.set(false);
    }
  }

  viewPastReport(report: DayClosingReport) {
    this.selectedPastReport.set(report);
  }

  closePastReport() {
    this.selectedPastReport.set(null);
  }

  // Print function using the iframe trick (only prints the report container)
  handlePrint() {
    const printContent = document.getElementById('print-report');
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Closing Report</title>
          <style>
            body { margin: 0; padding: 0; font-family: 'Lato', sans-serif; background: white; color: black; }
            .flex { display: flex !important; justify-content: space-between !important; }
            .text-center { text-align: center !important; }
            @page { margin: 0; size: 80mm auto; }
            body > div { width: 80mm !important; max-width: 80mm !important; padding: 10px !important; margin: 0 !important; }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
        </head>
        <body>
          <div>
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  }
}