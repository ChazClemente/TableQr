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
      this.errorMsg.set('Walang table session. I-scan ulit ang QR code.');
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
      return `Ubos na ang ${name || 'isa sa mga item'}. Alisin ito sa cart at subukan ulit.`;
    }
    if (msg.includes('Invalid session')) {
      return 'Expired o hindi valid ang QR session ng mesa. I-scan ulit ang QR code.';
    }
    if (msg.includes('not found')) {
      return 'May item na wala na sa menu. Bumalik sa menu at i-refresh.';
    }
    return 'Hindi na-submit ang order. Subukan ulit.';
  }
}