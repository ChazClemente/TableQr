import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../store/supabase.service';

export interface NavItem { path: string; label: string; icon: string; }

/** Shared shell for the Cashier and Inventory sections (CashierLayout / InventoryLayout in the React source). */
@Component({
  selector: 'app-staff-layout',
  imports: [RouterLink],
  templateUrl: './staff-layout.html',
})
export class StaffLayout {
  router = inject(Router);
  private supabase = inject(SupabaseService);
 subtitle = input('');
  nav = input<NavItem[]>([]);
  navClass = input('w-48');
  mainClass = input('p-6');

  async logout() {
    try {
      await this.supabase.signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
    await this.router.navigate(['/login']);
  }
}

export const CASHIER_NAV: NavItem[] = [
  { path: '/cashier/pos',      label: 'POS Terminal', icon: '🖥' },
  { path: '/cashier/bills',    label: 'Bills & Drawer', icon: '💵' },
  { path: '/cashier/discount', label: 'Discounts', icon: '🏷' },
  { path: '/cashier/receipts', label: 'Receipts', icon: '🧾' },
  { path: '/cashier/closing',  label: 'Day Close', icon: '🔒' },
];

export const INVENTORY_NAV: NavItem[] = [
  { path: '/inventory/ingredients',  label: 'Ingredient Master', icon: '🧂' },
  { path: '/inventory/recipes',      label: 'Recipe Mapping',    icon: '📖' },
  { path: '/inventory/stock',        label: 'Stock Monitor',     icon: '📊' },
  { path: '/inventory/variance',     label: 'Variance Engine',   icon: '⚖️' },
  { path: '/inventory/purchase-orders', label: 'Purchase Orders', icon: '📦' },
];