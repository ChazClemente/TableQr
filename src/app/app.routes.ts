import { Routes } from '@angular/router';
import { sessionGuard } from './guards/session.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },

  // INVALID / EXPIRED QR Session
  {
    path: 'invalid-session',
    loadComponent: () => import('./guards/invalid.session').then(m => m.InvalidSession),
  },
  // ADMIN (Nested Routes under AdminLayout)
  {
    path: 'admin',
    loadComponent: () => import('./components/admin-layout/admin-layout').then(m => m.AdminLayout), 
    children: [
      { path: '', redirectTo: 'qr', pathMatch: 'full' },
      { path: 'home', loadComponent: () => import('./pages/admin/admin-home/admin-home').then(m => m.AdminHome) },
      { path: 'qr', loadComponent: () => import('./pages/admin-qr/admin-qr').then(m => m.AdminQr) },
      { path: 'kds', loadComponent: () => import('./pages/admin/kds/kds').then(m => m.Kds) },
      { path: 'stock', loadComponent: () => import('./pages/admin/stock-control/stock-control').then(m => m.StockControl) },
      { path: 'workload', loadComponent: () => import('./pages/admin/workload/workload').then(m => m.Workload) },
      { path: 'menu', loadComponent: () => import('./pages/admin/menu-manager/menu-manager').then(m => m.MenuManager) },
      { path: 'floor', loadComponent: () => import('./pages/admin/floor-map/floor-map').then(m => m.FloorMap) },
      { path: 'users', loadComponent: () => import('./pages/admin/user-management/user-management').then(m => m.UserManagement) },
      { path: 'audit', loadComponent: () => import('./pages/admin/audit-log/audit-log').then(m => m.AuditLog) },
      { path: 'analytics', loadComponent: () => import('./pages/admin/analytics/analytics').then(m => m.Analytics) },
      { path: 'fire-time', loadComponent: () => import('./pages/admin/fire-time-advisor/fire-time-advisor').then(m => m.FireTimeAdvisor) },
      { path: 'substitution', loadComponent: () => import('./pages/admin/substitution-suggestion/substitution-suggestion').then(m => m.SubstitutionSuggestion) },
    ],
  },
  // Cashier
  { path: 'cashier/pos', loadComponent: () => import('./pages/cashier/pos-terminal/pos-terminal').then(m => m.PosTerminal) },
  { path: 'cashier/bills', loadComponent: () => import('./pages/cashier/bill-settlement/bill-settlement').then(m => m.BillSettlement) },
  { path: 'cashier/discount', loadComponent: () => import('./pages/cashier/discount-manager/discount-manager').then(m => m.DiscountManager) },
  { path: 'cashier/receipts', loadComponent: () => import('./pages/cashier/receipts/receipts').then(m => m.Receipts) },
  { path: 'cashier/closing', loadComponent: () => import('./pages/cashier/day-closing/day-closing').then(m => m.DayClosingComponent) },

  // Extended Admin
  { path: 'admin/menu', loadComponent: () => import('./pages/admin/menu-manager/menu-manager').then(m => m.MenuManager) },
  { path: 'admin/floor', loadComponent: () => import('./pages/admin/floor-map/floor-map').then(m => m.FloorMap) },
  { path: 'admin/users', loadComponent: () => import('./pages/admin/user-management/user-management').then(m => m.UserManagement) },
  { path: 'admin/audit', loadComponent: () => import('./pages/admin/audit-log/audit-log').then(m => m.AuditLog) },
  { path: 'admin/analytics', loadComponent: () => import('./pages/admin/analytics/analytics').then(m => m.Analytics) },
  { path: 'admin/fire-time', loadComponent: () => import('./pages/admin/fire-time-advisor/fire-time-advisor').then(m => m.FireTimeAdvisor) },
  { path: 'admin/substitution', loadComponent: () => import('./pages/admin/substitution-suggestion/substitution-suggestion').then(m => m.SubstitutionSuggestion) },

  // Inventory
  { path: 'inventory/ingredients', loadComponent: () => import('./pages/inventory/ingredient-master/ingredient-master').then(m => m.IngredientMaster) },
  { path: 'inventory/recipes', loadComponent: () => import('./pages/inventory/recipe-mapping/recipe-mapping').then(m => m.RecipeMapping) },
  { path: 'inventory/stock', loadComponent: () => import('./pages/inventory/stock-monitor/stock-monitor').then(m => m.StockMonitor) },
  { path: 'inventory/variance', loadComponent: () => import('./pages/inventory/variance-engine/variance-engine').then(m => m.VarianceEngine) },
  { path: 'inventory/purchase-orders', loadComponent: () => import('./pages/inventory/purchase-orders/purchase-orders').then(m => m.PurchaseOrders) },

  // Customer
 // Customer (naka-nest sa CustomerLayout)
{
  path: 'table/:tableId',
  canActivate: [sessionGuard],
  loadComponent: () => import('./components/customer-layout/customer-layout').then(m => m.CustomerLayout),
  children: [
    { path: '', redirectTo: 'menu', pathMatch: 'full' },
    { path: 'menu', loadComponent: () => import('./pages/menu/menu').then(m => m.Menu) },
    { path: 'cart', loadComponent: () => import('./pages/cart/cart').then(m => m.Cart) },
    { path: 'status', loadComponent: () => import('./pages/order-status/order-status').then(m => m.OrderStatus) },
    { path: 'order', redirectTo: 'status', pathMatch: 'full' },
    { path: 'payment', loadComponent: () => import('./pages/payment/payment').then(m => m.Payment) },
  ],
},

  { path: '**', redirectTo: '' },
];