import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { CardScanner, type ScannedData } from '../../../components/card-scanner/card-scanner';
import { CashierStore, type DiscountType } from '../../../store/cashier-store';

@Component({
  selector: 'app-discount-manager',
  imports: [CashierLayout, CardScanner, DatePipe],
  templateUrl: './discount-manager.html',
})
export class DiscountManager {
  private route = inject(ActivatedRoute);
  private store = inject(CashierStore);

  catalog = this.store.discountCatalog;
  catalogEntry = computed(() => this.catalog().find(d => d.type === this.discountType()));
  auditTrail = this.store.discountAudit;

  saving = signal(false);
  error = signal<string | null>(null);

  // ?bill=BILL-xxx (from BillSettlement)
  private preselect = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('bill'))),
    { initialValue: this.route.snapshot.queryParamMap.get('bill') },
  );

  openBills = computed(() => this.store.bills().filter(b => b.status === 'open'));

  selectedBillId = signal<string | null>(this.preselect() ?? this.openBills()[0]?.id ?? null);
  discountType = signal<DiscountType>('none');
  scannedData = signal<ScannedData | null>(null);
  applied = signal(false);

  selectedBill = computed(() => this.openBills().find(b => b.id === this.selectedBillId()) ?? null);

  // narrows DiscountType to what the scanner accepts
  scanType = computed(() => {
    const t = this.discountType();
    return t === 'senior' || t === 'pwd' ? t : null;
  });

  // the discount row + total shown in "Bill Preview"
  rowDiscount = computed(() => {
    const b = this.selectedBill();
    if (!b) return null;
    if (b.discount) {
      return {
        label: b.discount.label,
        percent: b.discount.percent,
        amount: b.discountAmount || Math.round((b.subtotal * b.discount.percent) / 100),
      };
    }
    const c = this.catalogEntry();
    if (c && this.discountType() !== 'none') {
      return { label: c.label, percent: c.percent, amount: Math.round((b.subtotal * c.percent) / 100) };
    }
    return null;
  });

  isPreview = computed(() => this.discountType() !== 'none' && !this.selectedBill()?.discount);

  previewTotal = computed(() => {
    const b = this.selectedBill();
    const row = this.rowDiscount();
    if (!b) return 0;
    if (!this.isPreview() || !row) return b.total;
    const taxBase = b.subtotal - row.amount;
    return taxBase + Math.round(taxBase * 0.05);
  });

  constructor() {
    effect(() => {
      const p = this.preselect();
      if (p) this.selectBill(p);
    });
  }

  // replaces the useEffect that reset everything when selectedBillId changed
  selectBill(id: string | null) {
    this.selectedBillId.set(id);
    this.discountType.set('none');
    this.scannedData.set(null);
    this.applied.set(false);
  }

  // replaces the useEffect that reset the scan when discountType changed
  selectType(type: DiscountType) {
    this.discountType.set(type);
    this.scannedData.set(null);
    this.applied.set(false);
  }

  onBillSelect(e: Event) {
    this.selectBill((e.target as HTMLSelectElement).value || null);
  }

  handleScanConfirm(data: ScannedData) {
    this.scannedData.set(data);
  }

  /**
   * Called when the card scanner detects that the scanned card's type
   * doesn't match the currently selected discount type.
   * We flip the toggle automatically and DO NOT clear the scan data —
   * the scanner keeps its parsed result and re-emits it via (confirmed).
   */
  onTypeMismatch(detected: 'senior' | 'pwd') {
    if (detected !== this.discountType()) {
      // Flip the type but keep the scanned data (the scanner will re-emit
      // the correctly-parsed data via (confirmed) right after this).
      this.discountType.set(detected);
      this.applied.set(false);
      // Note: we deliberately do NOT clear scannedData here — the scanner
      // will emit fresh data after this handler returns, which will
      // overwrite it anyway.
    }
  }

  async handleApply() {
    const bill = this.selectedBill();
    const entry = this.catalogEntry();
    const type = this.discountType();
    if (!bill || !entry || type === 'none' || this.saving()) return;
    if (entry.needsId && !this.scannedData()) return;

    const data = this.scannedData();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.store.applyDiscount(bill.id, {
        type,
        customerName: data?.name,
        idNumber: data?.idNumber,
        cardData: data?.extra,
      });
      this.applied.set(true);
    } catch (e) {
      console.error(e);
      this.error.set('Could not apply the discount. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async handleRemove() {
    const bill = this.selectedBill();
    if (!bill || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.store.removeDiscount(bill.id);
      this.discountType.set('none');
      this.scannedData.set(null);
      this.applied.set(false);
    } catch (e) {
      console.error(e);
      this.error.set('Could not remove the discount. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}