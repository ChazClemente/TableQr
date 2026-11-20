import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OrnateLeaf } from '../../components/ornate-leaf/ornate-leaf';
import { SupabaseService } from '../../store/supabase.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterOutlet, OrnateLeaf],
  template: `
    <div class="min-h-screen flex flex-col" style="background-color: #F4ECD8">
      <header class="texture-paper border-b" style="background: linear-gradient(135deg, #2C1810 0%, #5C2E0A 100%); border-color: #C4A882"
        [style.padding]="isKitchen() ? '12px 20px' : '18px 32px'">
        <div class="flex items-center gap-4" [class.max-w-5xl]="!isKitchen()" [class.mx-auto]="!isKitchen()">
          <app-ornate-leaf />
          <div>
            @if (isKitchen()) {
              <h1 class="text-white text-base font-bold" style="font-family: 'Playfair Display', serif">
                Kainan Kay Aling Nene
              </h1>
              <p class="text-xs opacity-50" style="color: #E8D5B0; letter-spacing: 0.1em">KITCHEN TERMINAL</p>
            } @else {
              <h1 class="text-white font-display text-xl" style="font-family: 'Playfair Display', serif; font-weight: 600">
                Kainan Kay Aling Nene — Admin Portal
              </h1>
              <p class="text-xs opacity-50" style="color: #E8D5B0; letter-spacing: 0.1em">TABLE &amp; ORDER MANAGEMENT</p>
            }
          </div>
          <div class="ml-auto flex items-center gap-4">
             @if (role() === 'admin' && !isHome())  {
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

      <!-- Kitchen staff get the same full-width layout as the cashier: side nav + wide content -->
      <div class="flex flex-1 overflow-hidden">
        @if (isKitchen()) {
          <nav class="w-14 md:w-44 flex-shrink-0 border-r flex flex-col py-4 gap-1" style="background: #FFF8EE; border-color: #C4A882">
            @for (item of kitchenNav; track item.link) {
              <a [routerLink]="item.link"
                class="flex items-center justify-center md:justify-start gap-2 px-2 md:px-4 py-2.5 text-xs font-bold transition-all mx-1 md:mx-2 rounded"
                style="font-family: Lato, sans-serif"
                [attr.title]="item.label"
                [style.color]="isActive(item.link) ? '#7A3B1E' : '#9B7B5A'"
                [style.background]="isActive(item.link) ? '#7A3B1E15' : 'transparent'"
                [style.border-left]="isActive(item.link) ? '3px solid #7A3B1E' : '3px solid transparent'">
                <span class="text-base leading-none">{{ item.icon }}</span>
                <span class="hidden md:inline">{{ item.label }}</span>
              </a>
            }
          </nav>
        }
        <main class="flex-1 min-w-0 p-6" [class.max-w-5xl]="!isKitchen()" [class.mx-auto]="!isKitchen()" [class.md:p-10]="!isKitchen()">
          <ng-content />
          <router-outlet />
        </main>
      </div>
    </div>
  `,
    styles: [`.active-nav { background: #F4ECD8; font-weight: 700; border-bottom: 3px solid #7A3B1E; }`],
})
export class AdminLayout {
  router = inject(Router);
  private supabase = inject(SupabaseService);
    role = signal('');
  isKitchen = computed(() => this.role() === 'kitchen');

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
    isActive(link: string): boolean {
    return this.router.url.split('?')[0].startsWith(link);
  }

  isHome(): boolean {
    return this.router.url.split('?')[0] === '/admin/home';
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
          <div>
            <h1 class="text-white text-base font-bold" style="font-family: 'Playfair Display', serif">
              Kainan Kay Aling Nene
            </h1>
            <p class="text-xs opacity-50" style="color: #E8D5B0; letter-spacing: 0.1em">INVENTORY TERMINAL</p>
          </div>

          <div class="ml-auto flex items-center gap-4">
            <a routerLink="/admin/home"
              class="text-xs opacity-70 hover:opacity-100 transition-opacity"
              style="color: #E8D5B0; font-family: Lato">
              ← Admin Dashboard
            </a>
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