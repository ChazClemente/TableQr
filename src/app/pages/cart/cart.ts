import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CartService } from '../..//services/cart.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.html',
})
export class Cart {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  cart = inject(CartService);

  tableId = toSignal(this.route.paramMap.pipe(map(p => p.get('tableId'))), { initialValue: null });

  cartItems = this.cart.items;
  subtotal = computed(() => this.cart.total());
  serviceCharge = computed(() => Math.round(this.subtotal() * 0.05));
  total = computed(() => this.subtotal() + this.serviceCharge());

  submitting = signal(false);
  errorMsg = signal<string | null>(null);

  goToMenu() {
    this.router.navigate(['/table', this.tableId(), 'menu']);
  }

  async handleOrder() {
     const id = this.tableId();
    if (this.submitting() || !this.cartItems().length) return;
    if (!id) {
      this.errorMsg.set('No table session. Please scan the QR code again.');
      return;
    }
      if (!this.cartItems().length || !id || this.submitting()) return;

    this.submitting.set(true);
    this.errorMsg.set(null);

    try {
      await this.cart.submitOrder(id);
      this.router.navigate(['/table', id, 'payment']);
    } catch (e) {
      this.errorMsg.set(this.friendly(e instanceof Error ? e.message : ''));
    } finally {
      this.submitting.set(false);
    }
  }

  private friendly(msg: string): string {
    if (msg.includes('Sold out')) {
      const name = msg.split('Sold out:')[1]?.trim();
      return `${name || 'One of the items'} is sold out. Remove it from the cart and try again.`;
    }
    if (msg.includes('Invalid session')) {
      return 'The table QR session has expired or is invalid. Please scan the QR code again.';
    }
    if (msg.includes('not found')) {
      return 'An item is no longer on the menu. Go back to the menu and refresh.';
    }
    return 'The order could not be submitted. Please try again.';
  }
}