import { Component, OnDestroy,inject } from '@angular/core';
import { AdminLayout } from '../../..//components/admin-layout/admin-layout';
import { CATEGORY_PREP, KitchenStore, type KitchenTicket, type TicketItem } from '../..//..//store/kitchen-store';
// ─── Fire-time calculation ────────────────────────────────────────────────────


interface FiredItem {
  item: TicketItem;
  prepMax: number;       // minutes
  fireOffsetMs: number;  // ms from now to start
  fireAt: Date;
  rank: number;
}

interface ComplianceEntry {
  ticketId: string;
  tableLabel: string;
  itemName: string;
  rank: number;
  decision: 'followed' | 'deviated';
  at: Date;
}

function calcFireSequence(ticket: KitchenTicket, targetServeMs: number): FiredItem[] {
  const now = Date.now();
  // Deduplicate by menuItemId for sequencing (treat each unique dish once)
  const unique = ticket.items.map(i => ({
    item: i,
    prepMax: CATEGORY_PREP[i.category]?.max ?? 15,
  }));
  // Fire time = targetServe - prepMax; offset from now
  const withFire = unique.map(u => ({
    ...u,
    fireAt: new Date(targetServeMs - u.prepMax * 60_000),
    fireOffsetMs: targetServeMs - u.prepMax * 60_000 - now,
  }));
  // Sort ascending by fireAt (earliest fire = start first)
  withFire.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return withFire.map((u, i) => ({ ...u, rank: i + 1 }));
}

function fmtOffset(ms: number) {
  if (ms <= 0) return 'Fire now';
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  if (mins === 0) return `in ${secs}s`;
  return `in ${mins}m ${secs}s`;
}

function urgencyColor(ms: number) {
  if (ms <= 0)         return { bg: '#C0392B15', border: '#C0392B50', text: '#C0392B' };
  if (ms < 120_000)    return { bg: '#D4A84315', border: '#D4A84350', text: '#8B6914' };
  return               { bg: '#4A7C5912', border: '#4A7C5950', text: '#4A7C59' };
}

// Target serve time: receivedAt + maxPrepAcrossAllItems + 2min buffer
function targetServeMs(ticket: KitchenTicket) {
  const maxPrep = Math.max(...ticket.items.map(i => CATEGORY_PREP[i.category]?.max ?? 15));
  return ticket.receivedAt.getTime() + (maxPrep + 2) * 60_000;
}

function fmtClock(d: Date) {
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Compliance log (module-level) ───────────────────────────────────────────

let complianceLog: ComplianceEntry[] = [];

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-fire-time-advisor',
  imports: [AdminLayout],
  templateUrl: './fire-time-advisor.html',
})
export class FireTimeAdvisor implements OnDestroy {
  selectedId: string | null = null;
  log: ComplianceEntry[] = [];
  prepEntries = Object.entries(CATEGORY_PREP);
  private kitchen = inject(KitchenStore);

  // Re-render every second so countdown is live
  private iv = setInterval(() => {}, 1000);
  ngOnDestroy() { clearInterval(this.iv); }

  fmtOffset = fmtOffset;
  fmtClock = fmtClock;
  urgency = urgencyColor;

  get activeTickets() { return this.kitchen.tickets().filter(t => t.status === 'preparing'); }
  get selected() {
    const active = this.activeTickets;
    return active.find(t => t.id === this.selectedId) ?? active[0] ?? null;
  }
  get sequence() {
    const s = this.selected;
    return s ? calcFireSequence(s, targetServeMs(s)) : [];
  }

  timeToServe(ticket: KitchenTicket) { return targetServeMs(ticket) - Date.now(); }
  targetServe(ticket: KitchenTicket) { return fmtClock(new Date(targetServeMs(ticket))); }
  dishCount(ticket: KitchenTicket) { return ticket.items.reduce((s, i) => s + i.quantity, 0); }
  itemNames(ticket: KitchenTicket) { return ticket.items.map(i => i.name).join(' · '); }
  offset(fi: FiredItem) { return fi.fireAt.getTime() - Date.now(); }

  get followed() { return this.log.filter(e => e.decision === 'followed').length; }
  get deviated() { return this.log.filter(e => e.decision === 'deviated').length; }
  get adoption() { return this.log.length ? Math.round(this.followed / this.log.length * 100) : 0; }

  logDecision(ticket: KitchenTicket, fi: FiredItem, decision: 'followed' | 'deviated') {
    const entry: ComplianceEntry = {
      ticketId: ticket.id,
      tableLabel: ticket.tableLabel,
      itemName: fi.item.name,
      rank: fi.rank,
      decision,
      at: new Date(),
    };
    complianceLog = [entry, ...complianceLog].slice(0, 50);
    this.log = [...complianceLog];
  }
}