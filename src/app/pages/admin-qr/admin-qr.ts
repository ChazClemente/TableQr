import {
  Component,
  DestroyRef,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import { supabase } from '../../services/supabase';
import { TableDto, TableService } from '../../services/table.service';

interface Table {
  id: string;
  label: string;
  token: string;
  url: string;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
  session: string; // status ng huling session (active / expired)
}

interface PrintItem {
  label: string;
  img: string;
}

// Modal (pamalit sa alert/confirm ng browser)
interface ModalState {
  title: string;
  message: string;
  detail?: string; // teknikal na error, kung meron
  confirmLabel?: string; // kung wala: OK lang (notice)
  danger?: boolean;
  run?: () => void | Promise<void>;
}

// Customer na nag-scan ng expired QR at humihingi ng bagong session
interface SessionRequest {
  request_id: number;
  table_id: number;
  requested_at: string;
}

function toTable(d: TableDto): Table {
  return {
    id: d.id,
    label: d.label,
    token: d.token,
    url: d.url,
    createdAt: new Date(d.createdAt),
    expiresAt: new Date(d.expiresAt),
    active: d.active,
    session: d.sessionStatus,
  };
}

// 'T05' -> 5
function numId(id: string): number {
  return Number(id.replace(/\D/g, ''));
}

// Hindi isasama ang lumang unpaid bills (stale) sa "In use"
const OPEN_BILL_HOURS = 12;
const EXPIRY_WARN_MINUTES = 30;

@Component({
  selector: 'app-admin-qr',
  imports: [FormsModule],
  templateUrl: './admin-qr.html',
  // None: kailangan para umabot ang print styles sa body.printing-qr
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      .qr-print-sheet { display: none; }
      @media print {
        body.printing-qr * { visibility: hidden !important; }
        body.printing-qr .qr-print-sheet,
        body.printing-qr .qr-print-sheet * { visibility: visible !important; }
        body.printing-qr .qr-print-sheet {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 16px;
          background: #fff;
        }
        .qr-print-card {
          break-inside: avoid;
          page-break-inside: avoid;
          border: 1px dashed #999;
          padding: 16px;
          text-align: center;
          color: #000;
        }
        .qr-print-card img { width: 260px; height: 260px; margin: 8px auto; display: block; }
        .qr-print-title { font-size: 22px; font-weight: 700; }
        .qr-print-sub { font-size: 12px; }
      }
    `,
  ],
})
export class AdminQr {
  private api = inject(TableService);
  private destroyRef = inject(DestroyRef);

  tables = signal<Table[]>([]);
  selectedId = signal<string | null>(null);
  showAddForm = signal(false);
  qrDataUrl = signal('');

  // --- bago: live status, countdown, bulk, print, toast ---
  openBills = signal<Record<number, number>>({}); // table_id -> bilang ng unpaid bills
  billRequested = signal<Record<number, boolean>>({}); // table_id -> humingi ng bill
  requests = signal<SessionRequest[]>([]); // pending na "need new session"
  now = signal(Date.now());
  bulkCount = signal(1);
  sheet = signal<PrintItem[]>([]);
  toast = signal('');
copiedKey = signal(''); // alin ang kakakopya lang ('Token' o 'URL')
  modal = signal<ModalState | null>(null);
  private toastTimer = 0;
  private reloadTimer = 0;
  private copiedTimer = 0;

  selectedTable = computed(() => this.tables().find(t => t.id === this.selectedId()) ?? null);

  // URL galing mismo sa database (session_link)
  selectedUrl = computed(() => this.selectedTable()?.url ?? '');
  nextLabel = computed(() => {
    const nums = this.tables()
      .map(t => Number(t.label.replace(/\D/g, '')))
      .filter(n => Number.isFinite(n) && n > 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `Table ${next}`;
  });

  stats = computed(() => {
    const list = this.tables();
    const busy = this.openBills();
    return [
      { label: 'Total Tables', value: list.length },
      { label: 'Active Sessions', value: list.filter(t => t.active).length },
      { label: 'Inactive', value: list.filter(t => !t.active).length },
      { label: 'In Use', value: list.filter(t => (busy[numId(t.id)] ?? 0) > 0).length },
      { label: 'Session Duration', value: '3 hrs' },
    ];
  });

  constructor() {
    // regenerate QR image whenever the selected table / token changes
    effect(() => {
      const url = this.selectedUrl();
      if (!url) {
        this.qrDataUrl.set('');
        return;
      }
      QRCode.toDataURL(url, {
        errorCorrectionLevel: 'H',
        width: 180,
        margin: 0,
        color: { dark: '#2C1810', light: '#FFF8EE' },
      }).then(data => {
        if (url === this.selectedUrl()) this.qrDataUrl.set(data);
      });
    });

    // Countdown tick (bawat 30s)
    const tick = window.setInterval(() => this.now.set(Date.now()), 30_000);

    // Live: kapag may nagbago sa mesa, bill o order
    const channel = supabase.channel('admin-qr-live');
    for (const table of ['tables', 'bill', 'orders', 'qr_session', 'qr_session_request']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        this.scheduleReload(),
      );
    }
    channel.subscribe();

    // Linisin ang print mode pagkatapos mag-print / cancel
    const afterPrint = () => {
      document.body.classList.remove('printing-qr');
      this.sheet.set([]);
    };
    window.addEventListener('afterprint', afterPrint);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(tick);
      window.clearTimeout(this.reloadTimer);
      window.clearTimeout(this.toastTimer);
      window.removeEventListener('afterprint', afterPrint);
      document.body.classList.remove('printing-qr');
      supabase.removeChannel(channel);
    });

    this.load();
    void this.loadLive();
    void this.loadRequests();
  }

  private scheduleReload() {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => {
      this.load();
      void this.loadLive();
      void this.loadRequests();
    }, 400);
  }

  private fail(msg: string, err?: unknown) {
    console.error(msg, err);
    const detail = (err as { message?: string } | null)?.message;
    this.modal.set({ title: 'May problema', message: msg, detail });
  }

  // --- modal ---
  private askConfirm(opts: ModalState) {
    this.modal.set(opts);
  }

  closeModal() {
    this.modal.set(null);
  }

  async confirmModal() {
    const m = this.modal();
    this.closeModal();
    if (m?.run) await m.run();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.modal()) this.closeModal();
  }

  private labelOfId(tableId: string): string {
    return this.tables().find(t => t.id === tableId)?.label ?? tableId;
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.set(''), 2500);
  }

  load() {
    this.api.list().subscribe({
      next: list => {
        const tables = list.map(toTable);
        this.tables.set(tables);
        const current = this.selectedId();
        if (!current || !tables.some(t => t.id === current)) {
          this.selectedId.set(tables[0]?.id ?? null);
        }
      },
      error: err => {
        // Background refresh ito; toast lang para hindi mag-pop up ang modal tuwing may realtime event
        console.error('Hindi ma-load ang tables mula sa Supabase.', err);
        this.showToast('Hindi ma-load ang tables. Subukan ulit.');
      },
    });
  }

  // Aling mga mesa ang may unpaid bill ngayon
  async loadLive() {
    const { data, error } = await supabase
      .from('bill')
      .select('bill_id,bill_requested,orders(table_id,created_at,order_type)')
      .in('bill_status', ['unpaid', 'open']);
    if (error) {
      console.error('Hindi ma-load ang live status ng tables.', error);
      return;
    }
    const since = Date.now() - OPEN_BILL_HOURS * 3600_000;
    const map: Record<number, number> = {};
    const asked: Record<number, boolean> = {};
    for (const b of (data ?? []) as any[]) {
      const o = Array.isArray(b.orders) ? b.orders[0] : b.orders;
      if (!o || o.table_id == null) continue;
      if (o.order_type === 'take-out') continue; // take-out ay naka-table 1 sa cashier-store
      if (new Date(o.created_at).getTime() < since) continue;
      const id = Number(o.table_id);
      map[id] = (map[id] ?? 0) + 1;
      if (b.bill_requested) asked[id] = true;
    }
    this.openBills.set(map);
    this.billRequested.set(asked);
  }

  // Mga customer na nag-scan ng expired QR (galing sa request_new_session)
  async loadRequests() {
    const { data, error } = await supabase
      .from('qr_session_request')
      .select('request_id,table_id,requested_at')
      .eq('handled', false)
      .order('requested_at');
    if (error) {
      console.error('Hindi ma-load ang session requests.', error);
      return;
    }
    this.requests.set((data ?? []) as SessionRequest[]);
  }

  labelOfTable(tableId: number): string {
    return this.tables().find(t => numId(t.id) === tableId)?.label ?? `Table ${tableId}`;
  }

  private async markHandled(req: SessionRequest) {
    const { error } = await supabase
      .from('qr_session_request')
      .update({ handled: true, handled_at: new Date().toISOString() })
      .eq('request_id', req.request_id);
    if (error) console.error('Hindi na-mark na handled ang request.', error);
    this.requests.update(list => list.filter(r => r.request_id !== req.request_id));
  }

  // Bagong session para sa mesang humingi, tapos i-mark na handled
  async issueForRequest(req: SessionRequest) {
    const id = 'T' + String(req.table_id).padStart(2, '0');
    // Bagong session lang; hindi ginagalaw ang QR sa mesa
    const { error } = await supabase.rpc('staff_open_session', {
      p_table_id: req.table_id,
      p_base_url: window.location.origin,
    });
    if (error) {
      this.fail('Hindi nabuksan ang bagong session.', error);
      return;
    }
    this.selectedId.set(id);
    await this.markHandled(req);
    this.load();
    this.showToast(`Bagong session para sa ${this.labelOfTable(req.table_id)}.`);
  }

  dismissRequest(req: SessionRequest) {
    void this.markHandled(req);
  }

  private replace(updated: Table) {
    this.tables.update(list => list.map(t => (t.id === updated.id ? updated : t)));
  }

  toggleAddForm() {
    this.showAddForm.update(v => !v);
  }

  selectTable(id: string) {
    this.selectedId.set(id);
  }

  addTable() {
    const label = this.nextLabel();
    this.api.add(label).subscribe({
      next: d => {
        const table = toTable(d);
        this.tables.update(list => [...list, table]);
        this.selectedId.set(table.id);
        this.showAddForm.set(false);
      },
      error: err => this.fail('Hindi nagawa ang table.', err),
    });
  }

  // Bulk: gumawa ng 1-20 tables nang sunod-sunod
  async addMany() {
    const n = Math.max(1, Math.min(20, Math.floor(Number(this.bulkCount()) || 1)));
    let created = 0;
    for (let i = 0; i < n; i++) {
      try {
        const d = await firstValueFrom(this.api.add(this.nextLabel()));
        const table = toTable(d);
        this.tables.update(list => [...list, table]);
        this.selectedId.set(table.id);
        created++;
      } catch (err) {
        this.fail(`Huminto sa ${created}/${n}. Hindi nagawa ang susunod na table.`, err);
        break;
      }
    }
    if (created) this.showToast(`${created} table${created > 1 ? 's' : ''} ang nagawa.`);
    this.showAddForm.set(false);
    this.bulkCount.set(1);
  }

  regenerateToken(tableId: string) {
    const label = this.labelOfId(tableId);
    const n = this.billsOf(tableId);
    this.askConfirm({
      title: 'I-regenerate ang QR?',
      message: `Ire-rotate nito ang QR ng ${label}. Hindi na gagana ang naka-print na QR at kailangang i-print ulit.`,
      detail: n > 0 ? `May ${n} unpaid bill pa ang mesang ito.` : undefined,
      confirmLabel: 'Regenerate',
      danger: true,
      run: () => {
        this.api.regenerate(tableId).subscribe({
          next: d => this.replace(toTable(d)),
          error: err => this.fail('Hindi na-regenerate ang QR.', err),
        });
      },
    });
  }

  // Isara ang kasalukuyang session (hal. cash na bayad, walk-out). Static pa rin ang QR.
  closeSession(tableId: string) {
    const label = this.labelOfId(tableId);
    const n = this.billsOf(tableId);
    this.askConfirm({
      title: 'Isara ang session?',
      message: `Hindi na makakapag-order ang mga kasalukuyang customer ng ${label}. Magbubukas ng bagong session sa susunod na scan. Hindi magbabago ang QR sa mesa.`,
      detail: n > 0 ? `May ${n} unpaid bill pa ang mesang ito.` : undefined,
      confirmLabel: 'Close session',
      danger: true,
      run: async () => {
        const { error } = await supabase.rpc('close_session', { p_table_id: numId(tableId) });
        if (error) {
          this.fail('Hindi naisara ang session.', error);
          return;
        }
        this.load();
        this.showToast('Naisara ang session. Magbubukas ng bago sa susunod na scan.');
      },
    });
  }

  toggleActive(tableId: string) {
    const t = this.tables().find(x => x.id === tableId);
    const doToggle = () => {
      this.api.toggle(tableId).subscribe({
        next: d => this.replace(toTable(d)),
        error: err => this.fail('Hindi na-update ang status.', err),
      });
    };
    const n = this.billsOf(tableId);
    // Babala lang kapag ide-deactivate ang mesang may unpaid bill
    if (t?.active && n > 0) {
      this.askConfirm({
        title: 'I-deactivate ang mesa?',
        message: `May ${n} unpaid bill pa ang ${t.label}. Hindi na makakapag-order ang mga customer kapag na-deactivate.`,
        confirmLabel: 'Deactivate',
        danger: true,
        run: doToggle,
      });
      return;
    }
    doToggle();
  }

  // --- helpers para sa template ---
  billsOf(tableId: string): number {
    return this.openBills()[numId(tableId)] ?? 0;
  }

  billAsked(tableId: string): boolean {
    return !!this.billRequested()[numId(tableId)];
  }

  toDate(iso: string): Date {
    return new Date(iso);
  }

  timeLeft(t: Table): string {
  const ms = t.expiresAt.getTime() - this.now();
  if (ms <= 0 || t.session !== 'active') return 'No active session';
  const m = Math.floor(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
}

  expiryState(t: Table): 'expired' | 'soon' | 'ok' {
    const ms = t.expiresAt.getTime() - this.now();
    if (ms <= 0 || t.session !== 'active') return 'expired';
    return ms <= EXPIRY_WARN_MINUTES * 60_000 ? 'soon' : 'ok';
  }

  formatTime(date: Date) {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  // --- copy / download ---
  async copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    this.copiedKey.set(what);
    window.clearTimeout(this.copiedTimer);
    this.copiedTimer = window.setTimeout(() => this.copiedKey.set(''), 1500);
    this.showToast(`${what} copied.`);
  } catch {
    this.showToast('Hindi na-copy. Pakitry ulit.');
  }
}

  async downloadPng() {
    const t = this.selectedTable();
    if (!t) return;
    const data = await QRCode.toDataURL(t.url, {
      errorCorrectionLevel: 'H',
      width: 1024,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    const a = document.createElement('a');
    a.href = data;
    a.download = `${t.label.replace(/\s+/g, '-')}-QR.png`;
    a.click();
  }

  // --- print ---
  print() {
    window.print();
  }

  // Isang table lang, malinis na print layout
  async printSelected() {
    const t = this.selectedTable();
    if (t) await this.runPrint([t]);
  }

  // Lahat ng active tables sa isang sheet
  async printAll() {
    const list = this.tables().filter(t => t.active);
    if (!list.length) {
      this.showToast('Walang active na table.');
      return;
    }
    await this.runPrint(list);
  }

  private async runPrint(list: Table[]) {
    const items: PrintItem[] = await Promise.all(
      list.map(async t => ({
        label: t.label,
        img: await QRCode.toDataURL(t.url, {
          errorCorrectionLevel: 'H',
          width: 600,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
        }),
      })),
    );
    this.sheet.set(items);
    document.body.classList.add('printing-qr');
    await new Promise(r => setTimeout(r, 150)); // hintayin ang render ng sheet
    window.print();
  }
}