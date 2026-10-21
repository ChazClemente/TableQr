import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Transaction } from '../../store/cashier-store';

@Component({
  selector: 'app-receipt-view',
  imports: [DatePipe],
  templateUrl: './receipt-view.html',
})
export class ReceiptView {
  tx = input.required<Transaction>();

  // Calculate VATable sales (Subtotal / 1.12)
  vatableSales = computed(() => Math.round(this.tx().subtotal / 1.12));
  
  // Calculate VAT (Subtotal - VATable Sales)
  vat = computed(() => Math.round(this.tx().subtotal - this.tx().subtotal / 1.12));

  paymentLabel = computed(() => {
    const m = this.tx().paymentMethod;
    return m === 'cash' ? 'Cash Tendered' : m === 'gcash' ? 'GCash' : 'Maya';
  });

  // This triggers the browser's native print dialog.
  // Because of the @media print CSS we added to styles.css, 
  // it will only print the receipt and hide the rest of the app!
  handlePrint() {
    window.print();
  }
}