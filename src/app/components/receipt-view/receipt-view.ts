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

  vatableSales = computed(() => Math.round(this.tx().subtotal / 1.12));
  vat = computed(() => Math.round(this.tx().subtotal - this.tx().subtotal / 1.12));

  paymentLabel = computed(() => {
    const m = this.tx().paymentMethod;
    return m === 'cash' ? 'Cash Tendered' : m === 'gcash' ? 'GCash' : 'Maya';
  });
}