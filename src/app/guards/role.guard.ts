import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../store/supabase.service';

export type StaffRole = 'admin' | 'cashier' | 'kitchen';

export const HOME_BY_ROLE: Record<StaffRole, string> = {
  admin: '/admin/home',
  cashier: '/cashier/pos',
  kitchen: '/admin/kds',
};

export const roleGuard = (allowed: StaffRole[]): CanActivateFn => async () => {
  const router = inject(Router);
  const supabase = inject(SupabaseService);

  try {
    const profile = await supabase.getCurrentStaffProfile();
    if (!profile || !profile.active) return router.createUrlTree(['/login']);

    const role = String(profile.role).toLowerCase() as StaffRole;
    if (allowed.includes(role)) return true;

    return router.createUrlTree([HOME_BY_ROLE[role] ?? '/login']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};