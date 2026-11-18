import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CartService } from '../..//services/cart.service';
import { PaymentService, type DbBill, type DiscountInfo } from '../..//services/payment.service';
import { CardScanner, type ScannedData } from '../../components/card-scanner/card-scanner';

type Method = 'gcash' | 'maya' | 'cash' | null;
type PayState = 'select' | 'confirming' | 'done' | 'cash-pending';

const POLL_MS = 3000;

@Component({
  selector: 'app-payment',
   imports: [CardScanner],
  templateUrl: './payment.html',
})
export class Payment {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cart = inject(CartService);
  private pay = inject(PaymentService);

  private timer: ReturnType<typeof setInterval> | null = null;

  tableId = toSignal(this.route.paramMap.pipe(map(p => p.get('tableId'))), { initialValue: null });

  order = this.cart.order;
  bill = signal<DbBill | null>(null);

  // total galing sa database (bill); fallback sa order habang naglo-load
  total = computed(() => this.bill()?.total ?? this.order()?.total ?? 0);

  refNumber = computed(() => {
    const id = this.bill()?.orderId ?? this.order()?.orderId;
    return id ? `KKAN-${String(id).padStart(6, '0')}` : '';
  });

  loading = signal(true);
  busy = signal(false);
  choosing = signal(false); // pinili ng customer na magpalit ng paraan
  errorMsg = signal<string | null>(null);
  notice = signal<string | null>(null);

  method = signal<Method>(null);
  payState = signal<PayState>('select');
    // --- Senior / PWD discount (auto-apply, no verification) ---
  discount = signal<DiscountInfo>({ status: 'none', type: null, discountAmount: 0 });
  discountOpen = signal(false);
  discountType = signal<'senior' | 'pwd'>('senior');
  discountScan = signal<ScannedData | null>(null);
  discountBusy = signal(false);
  discountMsg = signal<string | null>(null);

  methodLabel = computed(() => (this.method() === 'gcash' ? 'GCash' : this.method() === 'maya' ? 'Maya' : 'Cash'));

  walletOptions = [
    { key: 'gcash' as const, label: 'GCash', color: '#0066CC', emoji: '💙', sub: 'Opens GCash, amount is already set' },
    { key: 'maya' as const, label: 'Maya', color: '#1BAC4B', emoji: '💚', sub: 'Opens Maya, amount is already set' },
  ];

  constructor() {
    // when returning with the Back button from PayMongo (bfcache)
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        this.busy.set(false);
        this.safeRefresh();
      }
    };
    window.addEventListener('pageshow', onShow);

    inject(DestroyRef).onDestroy(() => {
      this.stopPoll();
      window.removeEventListener('pageshow', onShow);
    });

    this.init();
  }

  private id(): string | null {
    return this.tableId() ?? this.route.snapshot.paramMap.get('tableId');
  }

  private async init() {
    const id = this.id();
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      if (!this.cart.order()) await this.cart.loadLatest(id);
      await this.refreshBill();
      await this.refreshDiscount(); 
    } catch (e) {
      this.errorMsg.set(this.friendly(e));
    } finally {
      this.loading.set(false);
    }
  }

  /** Loads the bill + payment from the database and sets up the page state. */
  private async refreshBill() {
    const id = this.id();
    if (!id) return;

    const b = await this.pay.getBill(id);
    this.bill.set(b);
    if (!b) return;

    const p = b.payment;
    if (p && (p.method === 'gcash' || p.method === 'maya' || p.method === 'cash')) {
      this.method.set(p.method);
    }

    if (b.billStatus === 'paid' || p?.status === 'verified') {
      this.stopPoll();
      this.choosing.set(false);
      this.payState.set('done');
      return;
    }

    if (this.choosing()) return;

    if (p?.status === 'pending') {
      this.payState.set(p.method === 'cash' ? 'cash-pending' : 'confirming');
      this.startPoll();
      return;
    }

    this.stopPoll();
    if (p?.status === 'rejected') {
      this.notice.set('The last payment did not go through. Please choose a payment method again.');
    }
    this.payState.set('select');
  }

    private startPoll() {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        const id = this.id();
        // backup: ask PayMongo whether it has been paid (in case the webhook did not arrive)
        if (id && this.payState() === 'confirming') {
          await this.pay.verify(id).catch(() => false);
        }
        await this.refreshBill();
      } catch {
        /* pansamantalang network error */
      }
    }, POLL_MS);
  }

  private stopPoll() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async safeRefresh() {
    try {
      await this.refreshBill();
    } catch {
      /* ignore */
    }
  }
  // ─── Senior / PWD discount ─────────────────────────────────────────────────

  async refreshDiscount() {
    const id = this.id();
    if (!id) return;
    try {
      this.discount.set(await this.pay.getDiscount(id));
    } catch {
      /* ignore */
    }
  }

  toggleDiscountForm() {
    this.discountMsg.set(null);
    this.discountScan.set(null);
    this.discountOpen.update(v => !v);
  }

  setDiscountType(t: 'senior' | 'pwd') {
    this.discountType.set(t);
    this.discountScan.set(null);
  }

  onDiscountScan(data: ScannedData) {
    this.discountScan.set(data);
  }

  onDiscountMismatch(detected: 'senior' | 'pwd') {
    if (detected !== this.discountType()) this.discountType.set(detected);
  }

  async applyDiscount() {
    const id = this.id();
    const s = this.discountScan();
    if (!id || !s || !s.name || !s.idNumber || this.discountBusy()) return;

    this.discountBusy.set(true);
    this.discountMsg.set(null);
    try {
      await this.pay.applyDiscount(id, {
        type: this.discountType(),
        name: s.name,
        idNumber: s.idNumber,
        cardData: s.extra,
      });
      this.discountOpen.set(false);
      this.discountScan.set(null);
      await this.refreshBill(); // get the new total
      await this.refreshDiscount();
      this.discountMsg.set('Discount applied. This is your new total.');
    } catch (e) {
      this.discountMsg.set(this.discountFriendly(e));
    } finally {
      this.discountBusy.set(false);
    }
  }

  private discountFriendly(e: unknown): string {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Invalid session')) return 'The table QR session has expired or is invalid. Please scan the QR code again.';
    if (msg.includes('Already discounted')) return 'This bill already has a discount.';
    if (msg.includes('Payment started')) return 'A payment was already submitted, so a discount can no longer be added.';
    if (msg.includes('No bill')) return 'There is no bill to apply a discount to.';
    if (msg.includes('Missing ID')) return 'The name or ID number could not be read. Please scan the ID again.';
    return 'The discount could not be applied. Please try again.';
  }
  goToMenu() {
    this.router.navigate(['/table', this.tableId(), 'menu']);
  }

  goToStatus() {
    this.router.navigate(['/table', this.tableId(), 'status']);
  }

  changeMethod() {
    this.errorMsg.set(null);
    this.notice.set(null);
    this.choosing.set(true);
    this.payState.set('select');
  }

  async handleMethodSelect(m: Method) {
    if (!m || this.busy()) return;
    const id = this.id();
    if (!id) return;

    this.errorMsg.set(null);
    this.notice.set(null);
    this.method.set(m);
    this.busy.set(true);

    let redirecting = false;
    try {
      if (m === 'cash') {
        await this.pay.payCash(id);
        this.choosing.set(false);
        await this.refreshBill();
      } else {
        const url = await this.pay.startCheckout(id, m);
        this.choosing.set(false);
        redirecting = true;
        window.location.href = url; // opens GCash / Maya
      }
    } catch (e) {
      this.errorMsg.set(this.friendly(e));
      await this.safeRefresh();
    } finally {
      if (!redirecting) this.busy.set(false);
    }
  }

  private friendly(e: unknown): string {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Invalid session')) return 'The table QR session has expired or is invalid. Please scan the QR code again.';
    if (msg.includes('Already paid')) return 'This order is already paid.';
    if (msg.includes('already submitted')) return 'A payment was already submitted. Waiting for confirmation.';
    if (msg.includes('No order') || msg.includes('No bill')) return 'No order to pay.';
    if (msg.includes('provider')) return 'Could not reach the payment provider. Please try again.';
    return 'Something went wrong. Please try again.';
  }

    async handleDownloadReceipt() {
    const order = this.order();
    if (!order) return;

    const { jsPDF } = await import('jspdf');

    const total = this.total();
    const ref = this.refNumber();
    const W = 80; // mm, receipt-size
    const M = 6;
    const money = (n: number) =>
      'PHP ' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // measure the paper height first based on the number of items
    const probe = new jsPDF({ unit: 'mm', format: [W, 200] });
    probe.setFontSize(9);
    const nameLines = order.items.map(i => probe.splitTextToSize(`${i.qty}x ${i.item.name}`, W - M * 2 - 24) as string[]);
    const itemsH = nameLines.reduce((s, l) => s + l.length * 4.5 + 1.5, 0);
    const H = Math.max(110, 78 + itemsH + 30);

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
      ['Method', this.methodLabel()],
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
    y += 6;
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