import { Component, output, inject, signal } from '@angular/core';
import { CashierStore, type OrderType } from '../../store/cashier-store';

@Component({
  selector: 'app-order-type-modal',
  templateUrl: './order-type-modal.html',
})
export class OrderTypeModal {
  private store = inject(CashierStore);

  selected = output<{ type: OrderType; label: string }>();
  close = output<void>();

  // Get tables from the store
  tables = this.store.tables;
  
  // Keep track of which option is selected to show the dropdown
  selectedType = signal<OrderType | null>(null);
  selectedTableId = signal<string>('');

  options = [
    { type: 'dine-in' as OrderType, icon: '🍽', label: 'Dine-In', sub: 'Seated at a table' },
    { type: 'take-out' as OrderType, icon: '🥡', label: 'Take-Out', sub: 'Bring food home' },
  ];

  chooseType(type: OrderType) {
    if (type === 'take-out') {
      // Take-out doesn't need a table, so we emit immediately
      this.selected.emit({ type: 'take-out', label: 'Take-out' });
    } else {
      // For dine-in, show the table dropdown
      this.selectedType.set(type);
    }
  }

  confirmDineIn() {
    const tableId = this.selectedTableId();
    if (!tableId) return;
    
    // Find the table name to display on the receipt
    const table = this.tables().find(t => t.id === Number(tableId));
    
    // Emit the table ID as the label (e.g., "4")
    this.selected.emit({ 
      type: 'dine-in', 
      label: tableId 
    });
  }

  goBack() {
    this.selectedType.set(null);
  }
}