import { Component, computed, inject, signal, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CashierLayout } from '../../../components/cashier-layout/cashier-layout';
import { OrderTypeModal } from '../../../components/order-type-modal/order-type-modal';
import { type MenuItem, type Category } from '../../../data/menu'; 
import { MenuStore } from '../../../store/menu-store';
import { CashierStore, type BillItem, type OrderType } from '../../../store/cashier-store';
import { SupabaseService } from '../../../store/supabase.service'; 

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
  private route = inject(ActivatedRoute);
  private store = inject(CashierStore);
  private menu = inject(MenuStore);
  private supabase = inject(SupabaseService).client; 

  categories = this.menu.categories;
  categoryEmoji = this.menu.categoryEmojis;

  orderType = signal<OrderType | null>(null);
  tableLabel = signal('');
  activeCategory = signal<Category | null>(null);
  cart = signal<CartLine[]>([]);
  search = signal('');

  editingBillId = signal<string | null>(null);
  isLoadingExisting = signal(false);

  menuLoading = this.menu.loading;
  menuError = this.menu.error;
  saving = signal(false);
  saveError = signal<string | null>(null);

  constructor() {
    // 1. Check if we are adding to an existing order
    this.route.queryParamMap.subscribe(params => {
      const addToOrder = params.get('addToOrder');
      if (addToOrder) {
        this.isLoadingExisting.set(true);
        this.loadExistingOrder(addToOrder);
      }
    });

    // 2. Automatically select the first category
    effect(() => {
      const cats = this.categories();
      if (cats.length > 0 && !this.activeCategory()) {
        this.activeCategory.set(cats[0]);
      }
    });
  }

  private async loadExistingOrder(billId: string) {
    // 1. Wait for the menu to load first
    if (this.menu.items().length === 0) {
      setTimeout(() => this.loadExistingOrder(billId), 300);
      return;
    }

    // 2. Fetch the bill DIRECTLY from Supabase
    const { data, error } = await this.supabase
      .from('orders')
      .select(`
        order_id, order_type, table_id,
        order_item ( menu_id, quantity, item_subtotal, menu ( menu_name, menu_category ) )
      `)
      .eq('order_id', billId)
      .single();

    if (error || !data) {
      console.error("Could not fetch bill:", error);
      this.isLoadingExisting.set(false);
      return;
    }

    // 3. Find the table label (using CashierStore tables)
    const table = this.store.tables().find(t => t.id === data.table_id);
    
    this.editingBillId.set(billId);
    this.orderType.set(data.order_type === 'dine-in' ? 'dine-in' : 'take-out');
    this.tableLabel.set(table ? table.number : `Table ${data.table_id}`);
    
    // 4. Map items to the cart
    const cartLines: CartLine[] = (data.order_item || []).map((i: any) => {
      const menuItem = this.menu.items().find(m => String(m.id) === String(i.menu_id));
      return {
        item: menuItem || {
          id: String(i.menu_id),
          name: i.menu?.menu_name || 'Unknown Item',
          category: i.menu?.menu_category as Category || 'Ulam',
          price: i.quantity > 0 ? Number(i.item_subtotal) / i.quantity : 0,
          available: true,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
        } as MenuItem,
        qty: i.quantity
      };
    });

    this.cart.set(cartLines);
    this.isLoadingExisting.set(false);
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
    this.editingBillId.set(null);
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
      const existingId = this.editingBillId();

      if (existingId) {
        await this.store.updateBillItems(existingId, items, this.tableLabel());
        this.router.navigate(['/cashier/bills'], { queryParams: { highlight: existingId } });
      } else {
        const bill = await this.store.createBill(items, type, this.tableLabel(), 'pos');
        this.router.navigate(['/cashier/bills'], { queryParams: { highlight: bill.id } });
      }
    } catch (e) {
      console.error(e);
      this.saveError.set('Could not save the order. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}