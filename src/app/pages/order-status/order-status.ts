import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService, type DbBill } from '../..//services/payment.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SupabaseService } from '../../store/supabase.service'; // fix the path
import { CartService, OrderStatus as Status } from '../..//services/cart.service';

const STEPS: { key: Status; label: string; sub: string; icon: string }[] = [
  { key: 'confirmed', label: 'Order Received', sub: 'Your order has been received', icon: '📥' },
  { key: 'preparing', label: 'Preparing', sub: 'Our kitchen is cooking your order', icon: '👨‍🍳' },
  { key: 'ready', label: 'Ready', sub: 'Our staff will bring it to you shortly', icon: '✅' },
  { key: 'served', label: 'Served', sub: 'Enjoy your meal!', icon: '🍽' },
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
      /* temporary error, retry on the next poll */
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
  // Senior/PWD discount: based on the order items, not order().total
  itemsSubtotal = computed(() =>
    (this.order()?.items ?? []).reduce((s, c) => s + c.item.price * c.qty, 0)
  );
  hasDiscount = computed(() => {
    const b = this.bill();
    const sub = this.itemsSubtotal();
    return !!b && sub > 0 && b.total < sub + Math.round(sub * 0.05) - 0.5;
  });
  discountAmount = computed(() => (this.hasDiscount() ? Math.round(this.itemsSubtotal() * 0.2) : 0));
  subtotalShown = computed(() => (this.hasDiscount() ? this.itemsSubtotal() : this.subtotal()));
  serviceShown = computed(() =>
    this.hasDiscount()
      ? Math.round(this.bill()!.total - (this.itemsSubtotal() - this.discountAmount()))
      : this.serviceCharge()
  );
  totalShown = computed(() => (this.hasDiscount() ? this.bill()!.total : this.order()?.total ?? 0));

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

      const sub = this.hasDiscount() ? this.itemsSubtotal() : this.subtotal();
    const disc = this.discountAmount();
    const svc = this.serviceShown();
    const tot = this.totalShown();
    const sm = 'border-top:none;font-size:12px;font-weight:normal;color:#9B7B5A;padding:2px 8px';
    const summaryRows =
      `<tr><td colspan="2" style="${sm}">Subtotal</td><td style="${sm};text-align:right">₱${sub.toLocaleString()}</td></tr>` +
      (disc > 0
        ? `<tr><td colspan="2" style="${sm}">Senior/PWD Discount (20%)</td><td style="${sm};text-align:right">−₱${disc.toLocaleString()}</td></tr>`
        : '') +
      `<tr><td colspan="2" style="${sm}">Service Charge (5%)</td><td style="${sm};text-align:right">₱${svc.toLocaleString()}</td></tr>`;
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
<tfoot>${summaryRows}<tr><td colspan="2">Total</td><td style="text-align:right">₱${tot.toLocaleString()}</td></tr></tfoot></table>
<div class="center"><p class="muted">Thank you, please come again!</p><p class="muted">This is your official receipt.</p></div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${order.id}.html`;
    a.click();
    URL.revokeObjectURL(url);

  }
       async downloadReceiptPdf() {
    const order = this.order();
    if (!order) return;

    const { jsPDF } = await import('jspdf');

    const ref = `KKAN-${String(order.orderId).padStart(6, '0')}`;
    const sub = this.hasDiscount() ? this.itemsSubtotal() : this.subtotal();
    const disc = this.discountAmount();
    const svc = this.serviceShown();
    const total = this.totalShown();
    const pm = this.bill()?.payment?.method;
    const methodLabel = pm === 'gcash' ? 'GCash' : pm === 'maya' ? 'Maya' : pm === 'cash' ? 'Cash' : '';

    const W = 80;
    const M = 6;
    const money = (n: number) =>
      'PHP ' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const probe = new jsPDF({ unit: 'mm', format: [W, 200] });
    probe.setFontSize(9);
    const nameLines = order.items.map(i => probe.splitTextToSize(`${i.qty}x ${i.item.name}`, W - M * 2 - 24) as string[]);
    const itemsH = nameLines.reduce((s, l) => s + l.length * 4.5 + 1.5, 0);
    const H = Math.max(110, 78 + itemsH + 30 + 18);

    const doc = new jsPDF({ unit: 'mm', format: [W, H] });
    const brown = [92, 46, 10] as const;
    const muted = [155, 123, 90] as const;
    let y = 12;

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...brown);
    doc.text('Kainan Kay Aling Nene', W / 2, y, { align: 'center' });
    y += 5;
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('Authentic Filipino Kitchen', W / 2, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(196, 168, 130);
    doc.line(M, y, W - M, y);
    y += 6;

    const meta: [string, string][] = [
      ['Order', String(order.id)],
      ['Table', String(this.tableId() ?? '')],
      ['Ref', ref],
      ...(methodLabel ? ([['Method', methodLabel]] as [string, string][]) : []),
      ['Date', new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })],
    ];
    doc.setFontSize(8.5);
    for (const [k, v] of meta) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...muted);
      doc.text(k, M, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(44, 24, 16);
      doc.text(v, W - M, y, { align: 'right' });
      y += 4.5;
    }

    y += 1;
    doc.line(M, y, W - M, y);
    y += 5;

    doc.setFontSize(9);
    order.items.forEach((i, idx) => {
      const lines = nameLines[idx];
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(44, 24, 16);
      doc.text(lines, M, y);
      doc.text(money(i.item.price * i.qty), W - M, y, { align: 'right' });
      y += lines.length * 4.5 + 1.5;
    });

    doc.line(M, y, W - M, y);
    y += 5;

    const sumRow = (k: string, v: string, green = false) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...muted);
      doc.text(k, M, y);
      if (green) doc.setTextColor(74, 124, 89);
      else doc.setTextColor(44, 24, 16);
      doc.text(v, W - M, y, { align: 'right' });
      y += 4.5;
    };
    sumRow('Subtotal', money(sub));
    if (disc > 0) sumRow('Senior/PWD Discount (20%)', '-' + money(disc), true);
    sumRow('Service Charge (5%)', money(svc));

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...brown);
    doc.text('Total (incl. 5% service)', M, y);
    y += 5.5;
    doc.setFontSize(13);
    doc.text(money(total), W - M, y, { align: 'right' });

    y += 12;
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('Thank you, please come again!', W / 2, y, { align: 'center' });
    y += 4;
    doc.text('This is your official receipt.', W / 2, y, { align: 'center' });
    doc.setDisplayMode('fullwidth');
    doc.save(`receipt-${ref}.pdf`);
  }
}