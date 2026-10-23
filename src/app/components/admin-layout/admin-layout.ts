import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OrnateLeaf } from '../../components/ornate-leaf/ornate-leaf';
import { SupabaseService } from '../../store/supabase.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, OrnateLeaf],
  template: `
    <div class="min-h-screen" style="background-color: #F4ECD8">
      <header class="texture-paper border-b" style="background: linear-gradient(135deg, #2C1810 0%, #5C2E0A 100%); border-color: #C4A882; padding: 18px 32px">
        <div class="max-w-5xl mx-auto flex items-center gap-4">
          <app-ornate-leaf />
          <div>
            <h1 class="text-white font-display text-xl" style="font-family: 'Playfair Display', serif; font-weight: 600">
              Kainan Kay Aling Nene — Admin Portal
            </h1>
            <p class="text-xs opacity-50" style="color: #E8D5B0; letter-spacing: 0.1em">TABLE &amp; ORDER MANAGEMENT</p>
          </div>
          <div class="ml-auto flex items-center gap-4">
           @if (role() === 'admin') {
              <a routerLink="/admin/home" class="text-xs opacity-60 hover:opacity-100 transition-opacity" style="color: #E8D5B0">
                ← Admin Portal
              </a>
            }
            <button (click)="logout()"
              class="text-xs px-3 py-1 rounded border opacity-70 hover:opacity-100 transition-opacity"
              style="border-color: #C4A882; color: #E8D5B0; font-family: Lato">
              Log out
            </button>
          </div>
        </div>
      </header>
            @if (role() === 'kitchen') {
        <nav class="border-b" style="background: #FFF8EE; border-color: #E8D5B0">
          <div class="max-w-5xl mx-auto px-6 flex flex-wrap gap-1">
            @for (item of kitchenNav; track item.link) {
              <a [routerLink]="item.link" routerLinkActive="active-nav"
                class="px-4 py-3 text-sm transition-colors hover:bg-amber-50"
                style="color: #5C2E0A; font-family: Lato">
                {{ item.icon }} {{ item.label }}
              </a>
            }
          </div>
        </nav>
      }
      <main class="max-w-5xl mx-auto p-6 md:p-10">
  <ng-content />
  <router-outlet />
</main>
    </div>
  `,
    styles: [`.active-nav { background: #F4ECD8; font-weight: 700; border-bottom: 3px solid #7A3B1E; }`],
})
export class AdminLayout {
  router = inject(Router);
  private supabase = inject(SupabaseService);
    role = signal('');

  kitchenNav = [
    { label: 'Kitchen Display',     link: '/admin/kds',          icon: '🍳' },
    { label: 'Stock Control',       link: '/admin/stock',        icon: '📦' },
    { label: 'Workload',            link: '/admin/workload',     icon: '📊' },
    { label: 'Fire-Time Advisor',   link: '/admin/fire-time',    icon: '🔥' },
    { label: 'Substitution',        link: '/admin/substitution', icon: '🔄' },
  ];

  constructor() {
    this.supabase.getCurrentStaffProfile()
      .then(p => this.role.set(String(p?.role ?? '').toLowerCase()))
      .catch(() => {});
  }
  async logout() {
    try {
      await this.supabase.signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
    await this.router.navigate(['/login']);
  }
}

export interface NavItem { label: string; link: string; icon: string; }

export const INVENTORY_NAV: NavItem[] = [
  { label: 'Ingredient Master', link: '/inventory/ingredients',     icon: '🧂' },
  { label: 'Recipe Mapping',    link: '/inventory/recipes',         icon: '📖' },
  { label: 'Stock Monitor',     link: '/inventory/stock',           icon: '📊' },
  { label: 'Variance Engine',   link: '/inventory/variance',        icon: '⚖️' },
  { label: 'Purchase Orders',   link: '/inventory/purchase-orders', icon: '📦' },
];

@Component({
  selector: 'app-staff-layout',
  imports: [RouterLink, RouterLinkActive, OrnateLeaf],
  template: `
    <div class="min-h-screen" style="background-color: #F4ECD8">
      <header class="texture-paper border-b" style="background: linear-gradient(135deg, #2C1810 0%, #5C2E0A 100%); border-color: #C4A882; padding: 18px 32px">
        <div class="flex items-center gap-4">
          <app-ornate-leaf />
          
          <div class="ml-auto flex items-center gap-4">
            
            <button (click)="logout()"
              class="text-xs px-3 py-1 rounded border opacity-70 hover:opacity-100 transition-opacity"
              style="border-color: #C4A882; color: #E8D5B0; font-family: Lato">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div class="flex">
        <nav [class]="'shrink-0 border-r min-h-[calc(100vh-72px)] py-4 ' + navClass()" style="background: #FFF8EE; border-color: #E8D5B0">
          @for (item of nav(); track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active-nav"
              class="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-amber-50"
              style="color: #5C2E0A; font-family: Lato">
              <span>{{ item.icon }}</span><span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <main [class]="'flex-1 min-w-0 ' + mainClass()">
          <ng-content />
        </main>
      </div>
    </div>
  `,
  styles: [`.active-nav { background: #F4ECD8; font-weight: 700; border-left: 3px solid #7A3B1E; }`],
  
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