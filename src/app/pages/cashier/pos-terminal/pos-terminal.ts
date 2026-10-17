import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { OrderTypeModal, nextDineInId, nextTakeOutId } from '../../../components/order-type-modal/order-type-modal';
import { categories, type MenuItem, type Category } from '../../../data/menu';
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

  categories = categories;

  categoryEmoji: Record<Category, string> = {
    'Sabaw': '🍲', 'Ulam': '🍖', 'Kanin & Pansit': '🍚',
    'Pampagana': '🥗', 'Merienda': '🍮', 'Inumin': '🥤',
  };

  orderType = signal<OrderType | null>(null);
  tableLabel = signal('');
  activeCategory = signal<Category>('Ulam');
  cart = signal<CartLine[]>([]);
  search = signal('');

  // inside the class
private menu = inject(MenuStore);

menuLoading = this.menu.loading;
menuError = this.menu.error;
saving = signal(false);
saveError = signal<string | null>(null);

filteredItems = computed(() =>
  this.menu.items().filter(m => {
    const matchCat = m.category === this.activeCategory();
    const matchSearch = !this.search() || m.name.toLowerCase().includes(this.search().toLowerCase());
    return matchCat && matchSearch && m.available;
  })
);

  subtotal = computed(() => this.cart().reduce((s, c) => s + c.item.price * c.qty, 0));
  serviceCharge = computed(() => Math.round(this.subtotal() * 0.05));
  total = computed(() => this.subtotal() + this.serviceCharge());

  handleOrderTypeSelect(e: { type: OrderType; label: string }) {
    this.orderType.set(e.type);
    this.tableLabel.set(e.label);
  }

   quickPick(type: OrderType) {
    this.handleOrderTypeSelect({
      type,
      label: type === 'dine-in' ? nextDineInId() : nextTakeOutId(),
    });
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

  handleOrderTypeClose() {
  this.router.navigate(['/cashier/bills']);
}

 // handleConfirm becomes async
async handleConfirm() {
  console.log('confirm clicked', { type: this.orderType(), items: this.cart().length, saving: this.saving() });
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