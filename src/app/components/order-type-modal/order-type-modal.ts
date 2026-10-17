import { Component, output } from '@angular/core';
import type { OrderType } from '../../store/cashier-store';

let diCounter = Math.floor(Math.random() * 40) + 1;
let tkCounter = Math.floor(Math.random() * 20) + 1;

export const nextDineInId = () => `DI-${String(++diCounter).padStart(4, '0')}`;
export const nextTakeOutId = () => `TK-${String(++tkCounter).padStart(4, '0')}`;

@Component({
  selector: 'app-order-type-modal',
  templateUrl: './order-type-modal.html',
})
export class OrderTypeModal {
  selected = output<{ type: OrderType; label: string }>();
  close = output<void>();

  options = [
    { type: 'dine-in' as OrderType, icon: '🍽', label: 'Dine-In', sub: 'Seated at a table', genId: nextDineInId, prefix: 'DI' },
    { type: 'take-out' as OrderType, icon: '🥡', label: 'Take-Out', sub: 'Bring food home', genId: nextTakeOutId, prefix: 'TK' },
  ];

  pick(opt: (typeof this.options)[number]) {
    this.selected.emit({ type: opt.type, label: opt.genId() });
  }
}