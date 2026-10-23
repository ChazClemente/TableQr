
export type Role = 'Admin' | 'Cashier' | 'Kitchen';
export type SessionStatus = 'active' | 'idle' | 'offline';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  email: string;
  createdAt: Date;
  active: boolean;
  lastLogin?: Date;
}

export interface Session {
  userId: string;
  loginAt: Date;
  status: SessionStatus;
  ip: string;
  device: string;
}

export type AuditAction =
  | 'login' | 'logout'
  | 'price_change' | 'menu_add' | 'menu_delete'
  | 'bill_void' | 'discount_applied'
  | 'user_created' | 'user_updated' | 'user_deactivated'
  | 'po_created' | 'stock_received'
  | 'day_closed' | 'table_reassigned';

export interface AuditEvent {
  id: string;
  action: AuditAction;
  userId: string;
  userName: string;
  detail: string;
  at: Date;
  severity: 'info' | 'warn' | 'critical';
}

// ─── Seed data ────────────────────────────────────────────────────────────────

let users: AppUser[] = [
  { id: 'U01', name: 'Nene Reyes',       username: 'nene.admin',    role: 'Admin',   email: 'nene@kainan.ph',     createdAt: new Date('2024-01-10'), active: true,  lastLogin: new Date(Date.now() - 3 * 60000) },
  { id: 'U02', name: 'Aling Rosa',       username: 'rosa.cashier',  role: 'Cashier', email: 'rosa@kainan.ph',     createdAt: new Date('2024-02-15'), active: true,  lastLogin: new Date(Date.now() - 12 * 60000) },
  { id: 'U03', name: 'Mang Tino',        username: 'tino.kitchen',  role: 'Kitchen', email: 'tino@kainan.ph',     createdAt: new Date('2024-02-20'), active: true,  lastLogin: new Date(Date.now() - 5 * 60000) },
  { id: 'U04', name: 'Ligaya Santos',    username: 'ligaya.cashier', role: 'Cashier', email: 'ligaya@kainan.ph',   createdAt: new Date('2024-03-01'), active: true,  lastLogin: new Date(Date.now() - 60 * 60000) },
  { id: 'U05', name: 'Jun Dela Cruz',    username: 'jun.kitchen',    role: 'Kitchen', email: 'jun@kainan.ph',      createdAt: new Date('2024-04-12'), active: false, lastLogin: new Date('2025-12-01') },
];

let sessions: Session[] = [
  { userId: 'U01', loginAt: new Date(Date.now() - 3 * 60000),  status: 'active', ip: '192.168.1.10', device: 'Desktop Chrome' },
  { userId: 'U02', loginAt: new Date(Date.now() - 12 * 60000), status: 'idle',   ip: '192.168.1.21', device: 'Tablet Safari' },
  { userId: 'U03', loginAt: new Date(Date.now() - 5 * 60000),  status: 'active', ip: '192.168.1.30', device: 'Kitchen Display' },
  { userId: 'U04', loginAt: new Date(Date.now() - 61 * 60000), status: 'offline', ip: '192.168.1.22', device: 'POS Terminal' },
];

let auditLog: AuditEvent[] = [
  { id: 'A001', action: 'login',           userId: 'U01', userName: 'Nene Reyes',   detail: 'Admin login from 192.168.1.10',               at: new Date(Date.now() - 3 * 60000),    severity: 'info' },
  { id: 'A002', action: 'login',           userId: 'U03', userName: 'Mang Tino',    detail: 'Kitchen login from 192.168.1.30',             at: new Date(Date.now() - 5 * 60000),    severity: 'info' },
  { id: 'A003', action: 'login',           userId: 'U02', userName: 'Aling Rosa',   detail: 'Cashier login from 192.168.1.21',             at: new Date(Date.now() - 12 * 60000),   severity: 'info' },
  { id: 'A004', action: 'price_change',    userId: 'U01', userName: 'Nene Reyes',   detail: 'Bulalo Batangas: ₱320 → ₱345',               at: new Date(Date.now() - 30 * 60000),   severity: 'warn' },
  { id: 'A005', action: 'discount_applied',userId: 'U02', userName: 'Aling Rosa',   detail: 'Senior Citizen 20% on Bill #BILL-003',        at: new Date(Date.now() - 45 * 60000),   severity: 'warn' },
  { id: 'A006', action: 'bill_void',       userId: 'U02', userName: 'Aling Rosa',   detail: 'Bill #BILL-002 voided — customer cancelled',  at: new Date(Date.now() - 90 * 60000),   severity: 'critical' },
  { id: 'A007', action: 'menu_add',        userId: 'U01', userName: 'Nene Reyes',   detail: 'New item added: Dinuguan Special',             at: new Date(Date.now() - 2 * 3600000),  severity: 'info' },
  { id: 'A008', action: 'stock_received',  userId: 'U01', userName: 'Nene Reyes',   detail: 'PO-001 received: 20 kg Pork Belly from Batangas Prime', at: new Date(Date.now() - 3 * 3600000), severity: 'info' },
  { id: 'A009', action: 'day_closed',      userId: 'U02', userName: 'Aling Rosa',   detail: 'End-of-day closing — Cash: ₱12,450',          at: new Date(Date.now() - 18 * 3600000), severity: 'info' },
  { id: 'A010', action: 'user_created',    userId: 'U01', userName: 'Nene Reyes',   detail: 'New user created: Ligaya Santos (Cashier)',    at: new Date('2024-03-01'),              severity: 'info' },
];

type Listener = () => void;
const listeners: Listener[] = [];
function notify() { listeners.forEach(f => f()); }

export function getUsers() { return users; }
export function getSessions() { return sessions; }
export function getAuditLog() { return auditLog; }

export function saveUser(user: AppUser) {
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) users = users.map(u => u.id === user.id ? user : u);
  else users = [user, ...users];
  addAuditEvent({ action: idx >= 0 ? 'user_updated' : 'user_created', userId: 'U01', userName: 'Nene Reyes', detail: `${idx >= 0 ? 'Updated' : 'Created'} user: ${user.name} (${user.role})`, severity: 'info' });
  notify();
}

export function toggleUserActive(id: string) {
  users = users.map(u => u.id === id ? { ...u, active: !u.active } : u);
  const u = users.find(u => u.id === id)!;
  addAuditEvent({ action: 'user_deactivated', userId: 'U01', userName: 'Nene Reyes', detail: `${u.active ? 'Activated' : 'Deactivated'} user: ${u.name}`, severity: 'warn' });
  notify();
}

export function addAuditEvent(event: Omit<AuditEvent, 'id' | 'at'>) {
  auditLog = [{ ...event, id: `A${String(auditLog.length + 1).padStart(3, '0')}`, at: new Date() }, ...auditLog];
  notify();
}

export function terminateSession(userId: string) {
  sessions = sessions.map(s => s.userId === userId ? { ...s, status: 'offline' as SessionStatus } : s);
  notify();
}