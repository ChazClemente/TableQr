import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { BillCard } from '../../../components/bill-card/bill-card';
import { CashierStore, type PaymentMethod } from '../../../store/cashier-store';
import { KitchenStore } from '../../../store/kitchen-store';
import { InventoryStore } from '../../../store/inventory-store';
import { SupabaseService } from '../../../store/supabase.service';
import type { Category } from '../../../data/menu';

@Component({
  selector: 'app-bill-settlement',
  imports: [CashierLayout, BillCard, DatePipe],
  templateUrl: './bill-settlement.html',
})
export class BillSettlement {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(CashierStore);
  private kitchen = inject(KitchenStore);
  private inventory = inject(InventoryStore);
  private supabase = inject(SupabaseService).client;

  private paymongoPublicKey = 'pk_test_JiDAPj2j4dFiJpyoDxxqY1Li:';

  paymentMode = signal<'cash' | 'qr'>('cash');

  drawer = this.store.cashDrawer;
  openBills = computed(() => this.store.bills().filter(b => b.status === 'open'));

  private highlighted = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('highlight'))),
    { initialValue: this.route.snapshot.queryParamMap.get('highlight') },
  );

  selectedId = signal<string | null>(this.highlighted() ?? this.openBills()[0]?.id ?? null);
  selected = computed(() => this.openBills().find(b => b.id === this.selectedId()) ?? null);

  tendered = signal('');
  settled = signal<{ change: number; txnId: string } | null>(null);
  saving = signal(false);
  settleError = signal<string | null>(null);
  isRedirecting = signal(false);
  
  qrCodeImage = signal<string | null>(null);
  testUrl = signal<string | null>(null);
  private pollInterval: any;

  tenderedNum = computed(() => parseFloat(this.tendered()) || 0);
  change = computed(() => {
    const sel = this.selected();
    return sel ? Math.max(0, this.tenderedNum() - sel.total) : 0;
  });
  canSettle = computed(() => {
    const sel = this.selected();
    return !!sel && (this.paymentMode() === 'qr' || this.tenderedNum() >= sel.total);
  });

  quickAmounts = computed(() => {
    const sel = this.selected();
    if (!sel) return [];
    return [
      sel.total,
      Math.ceil(sel.total / 100) * 100,
      Math.ceil(sel.total / 500) * 500,
      Math.ceil(sel.total / 1000) * 1000,
    ].filter((v, i, a) => a.indexOf(v) === i);
  });

  constructor() {
    effect(() => {
      const h = this.highlighted();
      if (h) this.selectBill(h);
    });
  }

  selectBill(id: string | null) {
    this.selectedId.set(id);
    this.tendered.set('');
    this.settled.set(null);
    this.paymentMode.set('cash');
    this.settleError.set(null);
    this.cancelQR();
  }

  onTendered(e: Event) {
    this.tendered.set((e.target as HTMLInputElement).value);
  }

  quickTender(amt: number) {
    this.tendered.set(String(amt));
  }

  goToDiscount(billId: string) {
    this.router.navigate(['/cashier/discount'], { queryParams: { bill: billId } });
  }

  // NEW: Function to navigate back to POS to add more items
  addMoreItems(billId: string) {
    this.router.navigate(['/cashier/pos'], { queryParams: { addToOrder: billId } });
  }

  onMainAction() {
    if (this.paymentMode() === 'qr') this.handleDigitalPayment();
    else this.handleCashSettle();
  }

  async handleCashSettle() {
    const sel = this.selected();
    if (!sel || !this.canSettle() || this.saving()) return;

    this.saving.set(true);
    this.settleError.set(null);
    try {
      const tx = await this.store.settleBill(sel.id, this.tenderedNum(), 'cash');
      if (!tx) return;
      this.postSettlement(tx, sel);
    } catch (e) {
      console.error(e);
      this.settleError.set('Could not settle the bill. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDigitalPayment() {
    const sel = this.selected();
    if (!sel || this.saving()) return;

    this.saving.set(true);
    this.settleError.set(null);
    this.isRedirecting.set(true);

    try {
      const { data: intentData, error: intentError } = await this.supabase.functions.invoke('create-pos-payment', {
        body: { amount: sel.total, description: `Bill #${sel.id}`, billId: sel.id }
      });

      if (intentError || !intentData || intentData.error) {
        throw new Error(intentData?.error || 'Failed to create payment intent');
      }

      const intentId = intentData.data.id;
      const clientKey = intentData.data.attributes.client_key;

      const methodRes = await fetch('https://api.paymongo.com/v1/payment_methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(this.paymongoPublicKey), 
        },
        body: JSON.stringify({ data: { attributes: { type: 'qrph' } } })
      });
      
      const methodData = await methodRes.json();
      if (!methodRes.ok) throw new Error(methodData.errors?.[0]?.detail || 'Failed to create payment method');

      const attachRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(this.paymongoPublicKey),
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: methodData.data.id,
              client_key: clientKey,
            }
          }
        })
      });

      const attachData = await attachRes.json();
      if (!attachRes.ok) throw new Error(attachData.errors?.[0]?.detail || 'Failed to attach payment method');

      const qrImageUrl = attachData.data.attributes.next_action?.code?.image_url;
      const testUrl = attachData.data.attributes.next_action?.code?.test_url;
      
      if (qrImageUrl) {
        this.qrCodeImage.set(qrImageUrl); 
        this.testUrl.set(testUrl || null); 
        this.isRedirecting.set(false);
        this.saving.set(false);
        
        console.log("--- PAYMONGO TEST URL ---");
        console.log(testUrl);
        
        this.startPollingForPayment(sel.id);
      } else {
        throw new Error('No QR code returned from PayMongo');
      }

    } catch (e: any) {
      console.error(e);
      this.settleError.set(e.message || 'Could not generate QR code.');
      this.isRedirecting.set(false);
      this.saving.set(false);
    }
  }

    private startPollingForPayment(orderId: string) {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      const { data, error } = await this.supabase
        .from('bill')
        .select('bill_status')
        .eq('order_id', orderId);

      if (error) { console.error('Polling error:', error); return; }

      if (data?.some(b => b.bill_status === 'paid')) {
        this.stopPolling();
        this.qrCodeImage.set(null);
        this.testUrl.set(null);

        const sel = this.selected(); 
        await this.store.loadOpenBills(); // Refresh the list
        if (sel) this.postSettlement({ id: 'PAY-' + orderId, change: 0 }, sel);
      }
    }, 3000);
  }
  
  cancelQR() {
    this.qrCodeImage.set(null);
    this.testUrl.set(null);
    this.stopPolling();
    this.isRedirecting.set(false);
    this.saving.set(false);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private postSettlement(tx: any, sel: any) {
    if (sel.source === 'pos') {
      this.kitchen.addTicket({
        id: `TKT-${sel.id}`,
        orderId: sel.id,
        tableLabel: sel.tableLabel ?? sel.orderType,
        source: 'pos',
        status: 'preparing',
        receivedAt: new Date(),
        items: sel.items.map((i: any) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          category: i.category as Category,
        })),
      });
    }

    this.inventory.deductStockForBill(
      sel.id,
      sel.items.map((i: any) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
    );

    this.settled.set({ change: tx.change, txnId: tx.id });

    setTimeout(() => {
      this.settled.set(null);
      const remaining = this.store.bills().filter(b => b.status === 'open' && b.id !== sel.id);
      this.selectBill(remaining[0]?.id ?? null);
      this.router.navigate(['/cashier/bills']);
    }, 2500);
  }
}