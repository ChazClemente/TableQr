import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-cashier-layout',
  imports: [RouterLink],
  templateUrl: './cashier-layout.html',
})
export class CashierLayout {
  private router = inject(Router);

  nav = [
    { path: '/cashier/pos', label: 'POS Terminal', icon: '🖥' },
    { path: '/cashier/bills', label: 'Bills & Drawer', icon: '💵' },
    { path: '/cashier/discount', label: 'Discounts', icon: '🏷' },
    { path: '/cashier/receipts', label: 'Receipts', icon: '🧾' },
    { path: '/cashier/closing', label: 'Day Close', icon: '🔒' },
  ];

  isActive(path: string) {
    return this.router.url.startsWith(path);
  }

  logout() {
    this.router.navigate(['/login']);
  }
}