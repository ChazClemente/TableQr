import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService, type DbBill } from '../..//services/payment.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SupabaseService } from '../../store/supabase.service'; // ayusin ang path
import { CartService, OrderStatus as Status } from '../..//services/cart.service';

const STEPS: { key: Status; label: string; sub: string; icon: string }[] = [
  { key: 'confirmed', label: 'Order Received', sub: 'Natanggap na ang inyong order', icon: '📥' },
  { key: 'preparing', label: 'Inihahanda', sub: 'Niluluto na ng aming kusina', icon: '👨‍🍳' },
  { key: 'ready', label: 'Handa Na', sub: 'Ibibigay na ng aming kawani', icon: '✅' },
  { key: 'served', label: 'Nai-serve Na', sub: 'Enjoy your meal, kain na!', icon: '🍽' },
];

const STATUS_ORDER: Status[] = ['pending', 'confirmed', 'preparing', 'ready', 'served'];

@Component({
  selector: 'app-order-status',
  templateUrl: './order-status.html',
})
export class OrderStatus {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cart = inject(CartService);
  
  
  private db = inject(SupabaseService).client;
  

  tableId = toSignal(this.route.paramMap.pipe(map(p => p.get('tableId'))), { initialValue: null });

  order = this.cart.order;
    private pay = inject(PaymentService);
  private billTimer: ReturnType<typeof setInterval> | null = null;

  bill = signal<DbBill | null>(null);

  payState = computed<'paid' | 'pending' | 'unsettled'>(() => {
    const b = this.bill();
    if (!b) return 'unsettled';
    if (b.billStatus === 'paid' || b.payment?.status === 'verified') return 'paid';
    if (b.payment?.status === 'pending') return 'pending';
    return 'unsettled';
  });

  payLabel = computed(() => {
    const s = this.payState();
    return s === 'paid' ? 'Total Paid' : s === 'pending' ? 'Payment Pending' : 'Total Due';
  });

  payBadge = computed(() => {
    const s = this.payState();
    if (s === 'paid') return { text: '✅ Paid', bg: '#4A7C5920', color: '#4A7C59' };
    if (s === 'pending') return { text: '⏳ Pending', bg: '#D4A84325', color: '#8A6A10' };
    return { text: 'Unsettled', bg: '#8B2E2E15', color: '#8B2E2E' };
  });

  constructor() {
  this.loadBill();
  this.refreshOrderStatus();

  this.billTimer = setInterval(() => {
    this.loadBill();
    this.refreshOrderStatus();
  }, 4000);

  const channel = this.db
    .channel('customer-order-status')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ticket' }, () =>
      this.refreshOrderStatus(),
    )
    .subscribe();

  inject(DestroyRef).onDestroy(() => {
    if (this.billTimer) clearInterval(this.billTimer);
    this.db.removeChannel(channel);
  });
}
  

  private async loadBill() {
    const id = this.tableId() ?? this.route.snapshot.paramMap.get('tableId');
    if (!id) return;
    try {
      this.bill.set(await this.pay.getBill(id));
    } catch {
      /* pansamantalang error, subukan sa susunod na poll */
    }
  }
    private async refreshOrderStatus() {
    const o = this.order();
    if (!o) return;

    const orderId = Number(String(o.id).replace(/\D/g, ''));
    if (!orderId) return;

    const { data, error } = await this.db
      .from('ticket')
      .select('current_stage')
      .eq('order_id', orderId);
    if (error || !data?.length) return;

    const rank = ['pending', 'preparing', 'ready', 'served'];
    const slowest = data
      .map((t: any) => t.current_stage as string)
      .sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0];

    const map: Record<string, Status> = {
      pending: 'confirmed',
      preparing: 'preparing',
      ready: 'ready',
      served: 'served',
    };
    const next = map[slowest];
    if (next && next !== this.order()?.status) this.cart.updateOrderStatus(next);
  }
  steps = computed(() => {
    const o = this.order();
    if (!o) return [];
    const currentIdx = STATUS_ORDER.indexOf(o.status);
    return STEPS.map(step => ({
      ...step,
      done: STATUS_ORDER.indexOf(step.key) <= currentIdx,
      active: step.key === o.status || (step.key === 'confirmed' && o.status === 'pending'),
    }));
  });

  serviceCharge = computed(() => Math.round(((this.order()?.total ?? 0) * 0.05) / 1.05));
  subtotal = computed(() => (this.order()?.total ?? 0) - this.serviceCharge());

  goToMenu() {
    this.router.navigate(['/table', this.tableId(), 'menu']);
  }

  downloadReceipt() {
    const order = this.order();
    if (!order) return;

    const rows = order.items
      .map(
        ({ item, qty }) =>
          `<tr><td style="padding:4px 8px">${item.name}</td><td style="padding:4px 8px;text-align:center">${qty}</td><td style="padding:4px 8px;text-align:right">₱${(item.price * qty).toLocaleString()}</td></tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${order.id}</title>
<style>body{font-family:'Georgia',serif;max-width:320px;margin:40px auto;color:#2C1810;background:#FFF8EE;padding:24px}
h1{font-size:18px;margin:0}p{margin:4px 0;font-size:12px;color:#9B7B5A}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
thead tr{border-bottom:1px solid #C4A882}th{padding:4px 8px;text-align:left;font-size:11px;letter-spacing:.08em;color:#9B7B5A}
tfoot td{border-top:1px solid #C4A882;font-weight:bold;font-size:15px;padding:8px}
.center{text-align:center}.muted{color:#9B7B5A;font-size:11px;font-style:italic}
</style></head><body>
<div class="center"><h1>Kainan Kay Aling Nene</h1><p>Authentic Filipino Kitchen</p><hr style="border-color:#C4A882;margin:12px 0"></div>
<p><strong>Order:</strong> ${order.id}</p>
<p><strong>Table:</strong> ${order.tableId}</p>
<p><strong>Date:</strong> ${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="2">Total</td><td style="text-align:right">₱${order.total.toLocaleString()}</td></tr></tfoot></table>
<div class="center"><p class="muted">Salamat at bumalik po kayo!</p><p class="muted">This is your official receipt.</p></div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${order.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}