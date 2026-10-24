import { Component, inject, signal } from '@angular/core';
import { NotificationStore } from '../../store/notification-store';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-notification-container',
  imports: [DatePipe],
  templateUrl: './notification-container.html',
  styleUrl: './notification-container.css'
})
export class NotificationContainer {
  store = inject(NotificationStore);
  isOpen = signal(false);

  toggleDropdown() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.store.markAllAsRead();
    }
  }
}