import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { OrnateLeaf } from '../../components/ornate-leaf/ornate-leaf';

@Component({
  selector: 'app-customer-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, OrnateLeaf],
  templateUrl: './customer-layout.html',
})
export class CustomerLayout {
  private route = inject(ActivatedRoute);
  cart = inject(CartService);

  tableId = toSignal(this.route.paramMap.pipe(map(p => p.get('tableId'))), { initialValue: null });

  tabs = computed(() => {
    const base = ['/table', this.tableId()];
    return [
      { label: 'Menu', icon: '🍽', link: [...base, 'menu'] },
      { label: 'Cart', icon: '🛒', link: [...base, 'cart'] },
      { label: 'Order', icon: '📋', link: [...base, 'status'] },
      { label: 'Pay', icon: '💳', link: [...base, 'payment'] },
    ];
  });
}