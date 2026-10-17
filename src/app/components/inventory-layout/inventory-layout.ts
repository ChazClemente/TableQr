import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-inventory-layout',
  imports: [RouterLink],
  templateUrl: './inventory-layout.html',
})
export class InventoryLayout {
  private router = inject(Router);

  nav = [
    { path: '/inventory/ingredients', label: 'Ingredient Master', icon: '🧂' },
    { path: '/inventory/recipes', label: 'Recipe Mapping', icon: '📖' },
    { path: '/inventory/stock', label: 'Stock Monitor', icon: '📊' },
    { path: '/inventory/variance', label: 'Variance Engine', icon: '⚖️' },
    { path: '/inventory/purchase-orders', label: 'Purchase Orders', icon: '📦' },
  ];

  isActive(path: string) {
    return this.router.url.startsWith(path);
  }

  logout() {
    this.router.navigate(['/login']);
  }
}