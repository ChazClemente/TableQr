import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Bill } from '../../store/cashier-store';

@Component({
  selector: 'app-bill-card',
  imports: [DatePipe],
  templateUrl: './bill-card.html',
})
export class BillCard {
  bill = input.required<Bill>();
  active = input(false);
  picked = output<void>();

  age = computed(() => Math.floor((Date.now() - this.bill().createdAt.getTime()) / 60000));
}