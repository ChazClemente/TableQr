import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OrnateLeaf } from '../ornate-leaf/ornate-leaf';

@Component({
  selector: 'app-customer-layout',
  imports: [RouterLink, OrnateLeaf],
  templateUrl: './customer-layout.html',
})
export class CustomerLayout {
  private router = inject(Router);

  tableId = input<string>();

  tabs = computed(() => {
    const base = this.tableId() ? `/table/${this.tableId()}` : '';
    return [
      { label: 'Menu', path: `${base}/menu`, icon: '🍽' },
      { label: 'Cart', path: `${base}/cart`, icon: '🛒' },
      { label: 'Order', path: `${base}/order`, icon: '📋' },
      { label: 'Pay', path: `${base}/payment`, icon: '💳' },
    ];
  });

  isActive(path: string) {
    return this.router.url.startsWith(path);
  }
}