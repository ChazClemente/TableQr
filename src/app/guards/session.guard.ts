import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { supabase } from '../services/supabase';
import { OrderService } from '../services/order.service';

export const sessionGuard: CanActivateFn = async route => {
  const router = inject(Router);

  const tableId = route.paramMap.get('tableId') ?? '';
  const key = OrderService.tokenKey(tableId); // orderqr_token_T01
  const tableNum = OrderService.tableNumber(tableId);

  const bad = (reason: string) =>
    router.createUrlTree(['/invalid-session'], { queryParams: { reason } });

  const token = route.queryParamMap.get('token') ?? sessionStorage.getItem(key) ?? '';

  if (!tableId || !tableNum || !token) {
    return bad('missing');
  }

  try {
    const { data, error } = await supabase.rpc('validate_session', {
      p_table_id: tableNum,
      p_token: token,
    });

    if (error) return bad('error');

    if (data?.valid) {
      sessionStorage.setItem(key, token);
      return true;
    }

    sessionStorage.removeItem(key);
    return bad(data?.reason ?? 'invalid');
  } catch {
    return bad('error');
  }
};