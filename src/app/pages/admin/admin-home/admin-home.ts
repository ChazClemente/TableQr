import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { KitchenStore } from '../../../store/kitchen-store';
import { SupabaseService } from '../../../store/supabase.service';

interface Module {
  icon: string;
  title: string;
  description: string;
  link: string;
  badge: string | null;
  badgeColor: string;
  section: string;
}

@Component({
  selector: 'app-admin-home',
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './admin-home.html',
})
export class AdminHome {
  router = inject(Router);
  private supabase = inject(SupabaseService);
  private kitchen = inject(KitchenStore);
  logoutError = '';
  sections = ['Front of House', 'Kitchen', 'Cashier', 'System', 'Inventory'];

  get tickets() { return this.kitchen.tickets(); }
  get preparing() { return this.tickets.filter(t => t.status === 'preparing').length; }
  get ready() { return this.tickets.filter(t => t.status === 'ready').length; }
  get unavailable() { return this.kitchen.stock().filter(s => !s.available).length; }
  get stats() {
    return [
      { label: 'Preparing', value: this.preparing, color: '#D4A843', bg: '#D4A84315' },
      { label: 'Ready to Serve', value: this.ready, color: '#4A7C59', bg: '#4A7C5915' },
      { label: 'Items Unavailable', value: this.unavailable, color: '#7A3B1E', bg: '#7A3B1E15' },
      { label: 'Total Tickets', value: this.tickets.length, color: '#C4A882', bg: '#C4A88215' },
    ];
  }

  sectionModules(section: string) {
    return this.modules.filter(m => m.section === section);
  }

  async logout() {
    this.logoutError = '';
    try {
      await this.supabase.signOut();
      await this.router.navigate(['/login']);
    } catch (error) {
      this.logoutError = error instanceof Error ? error.message : 'Unable to sign out.';
    }
  }

  get modules(): Module[] {
    const { preparing, ready, unavailable } = this;
    return [
      {
        icon: '🍽',
        title: 'Menu Manager',
        description: 'Create and maintain menu items, categories, prices, descriptions, and modifier add-on setups. Master data source feeding the customer menu and kitchen availability.',
        link: '/admin/menu',
        badge: null,
        badgeColor: '',
        section: 'Front of House',
      },
      {
        icon: '🗺',
        title: 'Floor Map',
        description: 'Live colour-coded dining layout showing table status from open bills. Select and reassign an active order to a different table in two clicks.',
        link: '/admin/floor',
        badge: null,
        badgeColor: '',
        section: 'Front of House',
      },
      {
        icon: '🔲',
        title: 'Table QR Manager',
        description: 'Generate encrypted, session-bound QR codes. Each code links a physical table to a live ordering session with defined expiry.',
        link: '/admin/qr',
        badge: null,
        badgeColor: '',
        section: 'Front of House',
      },
      {
        icon: '📺',
        title: 'Kitchen Display',
        description: 'Live order feed combining QR-ordered and POS tickets in FCFS order with category grouping, timers, and delay warnings.',
        link: '/admin/kds',
        badge: preparing + ready > 0 ? `${preparing + ready} active` : null,
        badgeColor: '#D4A843',
        section: 'Kitchen',
      },
      {
        icon: '🥬',
        title: 'Stock Control',
        description: 'Mark dishes unavailable when ingredients run out. Changes propagate instantly to the customer-facing digital menu.',
        link: '/admin/stock',
        badge: unavailable > 0 ? `${unavailable} unavailable` : null,
        badgeColor: '#7A3B1E',
        section: 'Kitchen',
      },
      {
        icon: '📊',
        title: 'Kitchen Workload',
        description: 'Hourly order counts and category-level prep time baselines. Surfaces peak periods without tracking individual cook performance.',
        link: '/admin/workload',
        badge: null,
        badgeColor: '',
        section: 'Kitchen',
      },
      {
        icon: '🔥',
        title: 'Fire-Time Advisor',
        description: 'Recommends the ideal start time for each item on a multi-item ticket so all dishes finish simultaneously. Advisory only — cook decides.',
        link: '/admin/fire-time',
        badge: preparing > 0 ? `${preparing} active` : null,
        badgeColor: '#C0392B',
        section: 'Kitchen',
      },
      {
        icon: '🔄',
        title: 'Substitution Suggestion',
        description: 'Auto-suggests the top 1–2 similar available dishes the moment an item goes unavailable. Head Chef configures preferred substitutes and exclusions.',
        link: '/admin/substitution',
        badge: unavailable > 0 ? `${unavailable} out` : null,
        badgeColor: '#8B6914',
        section: 'Kitchen',
      },
      {
        icon: '🖥',
        title: 'POS Terminal',
        description: 'Counter order entry for walk-in and take-out customers. Select dine-in or take-out, build the order, confirm, and dispatch to kitchen.',
        link: '/cashier/pos',
        badge: null,
        badgeColor: '',
        section: 'Cashier',
      },
      {
        icon: '💵',
        title: 'Bills & Cash Drawer',
        description: 'Settle open bills, tender cash, compute change, and process incoming customer cash-payment requests with live drawer balance.',
        link: '/cashier/bills',
        badge: null,
        badgeColor: '',
        section: 'Cashier',
      },
      {
        icon: '🏷',
        title: 'Discount Manager',
        description: 'Apply Senior Citizen, PWD, employee, or promo discounts. Records ID numbers for government-mandated discounts with full audit trail.',
        link: '/cashier/discount',
        badge: null,
        badgeColor: '',
        section: 'Cashier',
      },
      {
        icon: '🧾',
        title: 'Receipts',
        description: 'View itemized digital receipts for all settled transactions. Print or export as PDF for physical copies.',
        link: '/cashier/receipts',
        badge: null,
        badgeColor: '',
        section: 'Cashier',
      },
      {
        icon: '🔒',
        title: 'End-of-Day Closing',
        description: 'Reconcile the cash drawer against expected totals, flag discrepancies, and generate the daily closing report.',
        link: '/cashier/closing',
        badge: null,
        badgeColor: '',
        section: 'Cashier',
      },
      {
        icon: '👥',
        title: 'User Management',
        description: 'Invite staff, assign Admin, Cashier, or Kitchen roles, and manage profile status and access.',
        link: '/admin/users',
        badge: null,
        badgeColor: '',
        section: 'System',
      },
      {
        icon: '📋',
        title: 'Audit Log',
        description: 'Review staff events, database-backed menu changes, and bill voids. Prototype business actions and discounts are not yet audited.',
        link: '/admin/audit',
        badge: null,
        badgeColor: '',
        section: 'System',
      },
      {
        icon: '📈',
        title: 'Analytics Dashboard',
        description: 'Revenue charts, best-seller rankings, peak dining-hour heatmap, and service speed metrics aggregated from POS, kitchen, and menu data. Exportable to CSV.',
        link: '/admin/analytics',
        badge: null,
        badgeColor: '',
        section: 'System',
      },
      {
        icon: '🧂',
        title: 'Ingredient Master',
        description: 'Centralised raw ingredient catalog with UOM, unit cost, supplier links, and category groupings that feed all recipe and stock calculations.',
        link: '/inventory/ingredients',
        badge: null,
        badgeColor: '',
        section: 'Inventory',
      },
      {
        icon: '📖',
        title: 'Recipe Mapping',
        description: 'Link each menu item to its raw ingredients and per-serving quantities. Stock auto-deducts from live levels upon payment settlement.',
        link: '/inventory/recipes',
        badge: null,
        badgeColor: '',
        section: 'Inventory',
      },
      {
        icon: '📊',
        title: 'Stock Monitor',
        description: 'Real-time inventory levels visualised against safety stock and reorder thresholds. Critical and Low flags propagate to the Kitchen Availability panel.',
        link: '/inventory/stock',
        badge: null,
        badgeColor: '',
        section: 'Inventory',
      },
      {
        icon: '⚖️',
        title: 'Variance Engine',
        description: 'Compare theoretical stock from sales deductions against physical counts. Flags spoilage, shrinkage, portion drift, and unaccounted losses.',
        link: '/inventory/variance',
        badge: null,
        badgeColor: '',
        section: 'Inventory',
      },
      {
        icon: '📦',
        title: 'Purchase Orders',
        description: 'Create POs by supplier, track sent and partial delivery statuses, and receive stock. Receiving a PO immediately increments live inventory.',
        link: '/inventory/purchase-orders',
        badge: null,
        badgeColor: '',
        section: 'Inventory',
      },
    ];
  }
}