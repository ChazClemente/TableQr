import { Component, computed, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { OrderTypeModal } from '../../../components/order-type-modal/order-type-modal';
import { type MenuItem, type Category } from '../../../data/menu'; 
import { MenuStore } from '../../../store/menu-store';
import { CashierStore, type BillItem, type OrderType } from '../../../store/cashier-store';

interface CartLine {
  item: MenuItem;
  qty: number;
}

@Component({
  selector: 'app-pos-terminal',
  imports: [CashierLayout, OrderTypeModal],
  templateUrl: './pos-terminal.html',
})
export class PosTerminal {
  private router = inject(Router);
  private store = inject(CashierStore);
  private menu = inject(MenuStore);

  categories = this.menu.categories;
  categoryEmoji = this.menu.categoryEmojis;

  orderType = signal<OrderType | null>(null);
  tableLabel = signal('');
  activeCategory = signal<Category | null>(null); 
  cart = signal<CartLine[]>([]);
  search = signal('');

  menuLoading = this.menu.loading;
  menuError = this.menu.error;
  saving = signal(false);
  saveError = signal<string | null>(null);

  constructor() {
    // Automatically select the first category once the menu loads
    effect(() => {
      const cats = this.categories();
      if (cats.length > 0 && !this.activeCategory()) {
        this.activeCategory.set(cats[0]);
      }
    });
  }

  filteredItems = computed(() => {
    const active = this.activeCategory();
    return this.menu.items().filter(m => {
      const matchCat = !active || m.category === active;
      const matchSearch = !this.search() || m.name.toLowerCase().includes(this.search().toLowerCase());
      return matchCat && matchSearch && m.available;
    });
  });

  subtotal = computed(() => this.cart().reduce((s, c) => s + c.item.price * c.qty, 0));
  serviceCharge = computed(() => Math.round(this.subtotal() * 0.05));
  total = computed(() => this.subtotal() + this.serviceCharge());

  handleOrderTypeSelect(e: { type: OrderType; label: string }) {
    this.orderType.set(e.type);
    this.tableLabel.set(e.label);
  }

  handleOrderTypeClose() {
    this.router.navigate(['/cashier/bills']);
  }

  changeOrderType() {
    this.orderType.set(null);
    this.cart.set([]);
  }

  selectCategory(cat: Category) {
    this.activeCategory.set(cat);
    this.search.set('');
  }

  onSearch(e: Event) {
    this.search.set((e.target as HTMLInputElement).value);
  }

  qtyInCart(id: string) {
    return this.cart().find(c => c.item.id === id)?.qty;
  }

  addItem(item: MenuItem) {
    this.cart.update(prev => {
      const ex = prev.find(c => c.item.id === item.id);
      return ex
        ? prev.map(c => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c))
        : [...prev, { item, qty: 1 }];
    });
  }

  setQty(id: string, qty: number) {
    if (qty <= 0) this.cart.update(prev => prev.filter(c => c.item.id !== id));
    else this.cart.update(prev => prev.map(c => (c.item.id === id ? { ...c, qty } : c)));
  }

  clearCart() {
    this.cart.set([]);
  }

  async handleConfirm() {
    const type = this.orderType();
    if (!this.cart().length || !type || this.saving()) return;

    const items: BillItem[] = this.cart().map(c => ({
      menuItemId: c.item.id,
      name: c.item.name,
      category: c.item.category,
      price: c.item.price,
      quantity: c.qty,
    }));

    this.saving.set(true);
    this.saveError.set(null);
    try {
      const bill = await this.store.createBill(items, type, this.tableLabel(), 'pos');
      this.router.navigate(['/cashier/bills'], { queryParams: { highlight: bill.id } });
    } catch (e) {
      console.error(e);
      this.saveError.set('Could not save the order. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}