import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'info' | 'warning';
  read: boolean;
  time: Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  notifications = signal<Notification[]>([]);
  private counter = 0;

  show(message: string, type: 'success' | 'info' | 'warning' = 'info') {
    const id = this.counter++;
    const newNotif: Notification = { id, message, type, read: false, time: new Date() };
    this.notifications.update(prev => [newNotif, ...prev]);
  }

  markAllAsRead() {
    this.notifications.update(prev => prev.map(n => ({ ...n, read: true })));
  }

  clearAll() {
    this.notifications.set([]);
  }

  unreadCount() {
    return this.notifications().filter(n => !n.read).length;
  }
}