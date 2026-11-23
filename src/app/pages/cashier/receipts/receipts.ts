import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { MiniCalendar } from '../../../components/mini-calendar/mini-calendar';
import { ReceiptView } from '../../../components/receipt-view/receipt-view';
import { CashierStore, type Transaction } from '../../../store/cashier-store';
import { NotificationStore } from '../../../store/notification-store';

@Component({
  selector: 'app-receipts',
  imports: [CashierLayout, MiniCalendar, ReceiptView, DatePipe],
  templateUrl: './receipts.html',
})
export class Receipts implements OnInit, OnDestroy {
  private store = inject(CashierStore);
  private notif = inject(NotificationStore);
  
  private refreshInterval: any;
  private previousTxnCount = 0;

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

    const results = this.allTxns().filter(t => {
      if (d && t.settledAt.toLocaleDateString('en-CA') !== d) return false;

      if (!q) return true;
      if (t.id.toLowerCase().includes(q)) return true;
      if (t.paymentMethod.toLowerCase().includes(q)) return true;
      if (t.orderType.toLowerCase().includes(q)) return true;
      if (t.items.some(i => i.name.toLowerCase().includes(q))) return true;

      return false;
    });

    // Sort newest first
    return results.sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime());
  });

  ngOnInit() {
    this.previousTxnCount = this.allTxns().length;

    // Refresh every 5 seconds
    this.refreshInterval = setInterval(async () => {
      await this.store.loadTransactions();
      
      const currentCount = this.allTxns().length;

      if (currentCount > this.previousTxnCount) {
        this.notif.show('New payment received!', 'success');
      }
      
      this.previousTxnCount = currentCount;
    }, 5000); 
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

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
    // 1. Get the receipt element from the DOM
    const printContent = document.getElementById('print-receipt');
    if (!printContent) return;

    // 2. Create a hidden iframe
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

    // 3. Write ONLY the receipt HTML into the iframe
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Print Receipt</title>
          <style>
            /* Reset margins */
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Lato', sans-serif; 
              background: white; 
              color: black; 
            }
            
            /* Ensure flex rows don't break */
            .flex { display: flex !important; justify-content: space-between !important; }
            
            /* FIX: size auto removes the giant blank space below the receipt */
            @page { 
              margin: 0; 
              size: auto; 
            }

            /* Force the wrapper to be exactly 80mm wide */
            body > div {
              width: 80mm !important;
              max-width: 80mm !important;
              padding: 5px !important;
              margin: 0 !important;
            }
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

    // 4. Trigger the print dialog
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // 5. Clean up the iframe after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  }
}