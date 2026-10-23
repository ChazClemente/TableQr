import { Injectable, signal } from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IngredientCategory = 'Proteins' | 'Produce' | 'Dry Goods' | 'Condiments & Seasonings' | 'Dairy & Eggs' | 'Packaging';
export type UOM = 'kg' | 'g' | 'L' | 'mL' | 'pcs' | 'pack' | 'tray' | 'bundle';
export type StockStatus = 'Good' | 'Low' | 'Critical';
export type POStatus = 'Draft' | 'Sent' | 'Received' | 'Partial';

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  uom: UOM;
  unitCost: number;          // cost per UOM
  supplierId: string;
  currentStock: number;
  safetyStock: number;       // minimum before Critical flag
  reorderPoint: number;      // minimum before Low flag
  reorderQty: number;        // suggested PO qty
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  leadDays: number;
}

export interface RecipeIngredient {
  ingredientId: string;
  qtyPerServing: number;     // in ingredient's UOM
}

export interface RecipeMapping {
  menuItemId: string;
  menuItemName: string;
  ingredients: RecipeIngredient[];
}

export interface VarianceRecord {
  id: string;
  ingredientId: string;
  date: Date;
  theoreticalQty: number;
  actualQty: number;
  variance: number;
  reason: 'spoilage' | 'shrinkage' | 'portion_drift' | 'theft' | 'unaccounted';
  flagged: boolean;
  poId?: string;
}

export interface POLineItem {
  ingredientId: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: POStatus;
  lineItems: POLineItem[];
  createdAt: Date;
  expectedAt: Date;
  receivedAt?: Date;
  notes?: string;
  total: number;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

export const suppliers: Supplier[] = [
  { id: 'SUP-01', name: 'Batangas Prime Meats', contact: '(043) 723-0012', email: 'orders@bataungasprime.ph', leadDays: 2 },
  { id: 'SUP-02', name: 'Ilocos Sur Seafood Coop', contact: '(077) 600-1234', email: 'coop@ilsseafood.ph', leadDays: 1 },
  { id: 'SUP-03', name: 'Tarlac Agri-Fresh Produce', contact: '(045) 491-5500', email: 'fresh@tarlacagri.ph', leadDays: 1 },
  { id: 'SUP-04', name: 'Manila Dry Goods Trading', contact: '(02) 8241-7700', email: 'trade@mdgt.ph', leadDays: 3 },
  { id: 'SUP-05', name: 'AlingNene Packaging Depot', contact: '(077) 722-9900', email: 'pack@depot.ph', leadDays: 2 },
];

const seedIngredients: Ingredient[] = [
  // Proteins
  { id: 'ING-01', name: 'Pork Belly (Liempo)', category: 'Proteins', uom: 'kg', unitCost: 380, supplierId: 'SUP-01', currentStock: 12.5, safetyStock: 5, reorderPoint: 10, reorderQty: 20 },
  { id: 'ING-02', name: 'Pork Shoulder (Kasim)', category: 'Proteins', uom: 'kg', unitCost: 320, supplierId: 'SUP-01', currentStock: 3.2, safetyStock: 4, reorderPoint: 8, reorderQty: 15 },
  { id: 'ING-03', name: 'Beef Shank (Bulalo Cut)', category: 'Proteins', uom: 'kg', unitCost: 520, supplierId: 'SUP-01', currentStock: 8.0, safetyStock: 3, reorderPoint: 6, reorderQty: 12 },
  { id: 'ING-04', name: 'Whole Chicken', category: 'Proteins', uom: 'kg', unitCost: 210, supplierId: 'SUP-01', currentStock: 15.0, safetyStock: 6, reorderPoint: 10, reorderQty: 20 },
  { id: 'ING-05', name: 'Bangus (Milkfish)', category: 'Proteins', uom: 'kg', unitCost: 250, supplierId: 'SUP-02', currentStock: 4.5, safetyStock: 3, reorderPoint: 6, reorderQty: 10 },
  { id: 'ING-06', name: 'Oxtail', category: 'Proteins', uom: 'kg', unitCost: 580, supplierId: 'SUP-01', currentStock: 5.0, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  // Produce
  { id: 'ING-07', name: 'Kangkong (Water Spinach)', category: 'Produce', uom: 'bundle', unitCost: 25, supplierId: 'SUP-03', currentStock: 8, safetyStock: 5, reorderPoint: 10, reorderQty: 20 },
  { id: 'ING-08', name: 'Sitaw (String Beans)', category: 'Produce', uom: 'kg', unitCost: 60, supplierId: 'SUP-03', currentStock: 2.0, safetyStock: 1, reorderPoint: 3, reorderQty: 5 },
  { id: 'ING-09', name: 'Green Papaya', category: 'Produce', uom: 'kg', unitCost: 35, supplierId: 'SUP-03', currentStock: 6.0, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-10', name: 'Eggplant (Talong)', category: 'Produce', uom: 'kg', unitCost: 55, supplierId: 'SUP-03', currentStock: 1.5, safetyStock: 2, reorderPoint: 4, reorderQty: 6 },
  { id: 'ING-11', name: 'White Onion', category: 'Produce', uom: 'kg', unitCost: 90, supplierId: 'SUP-03', currentStock: 5.0, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-12', name: 'Garlic', category: 'Produce', uom: 'kg', unitCost: 150, supplierId: 'SUP-03', currentStock: 3.5, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  { id: 'ING-13', name: 'Ginger (Luya)', category: 'Produce', uom: 'kg', unitCost: 110, supplierId: 'SUP-03', currentStock: 2.0, safetyStock: 0.5, reorderPoint: 1, reorderQty: 3 },
  { id: 'ING-14', name: 'Tamarind (Sampalok)', category: 'Produce', uom: 'kg', unitCost: 80, supplierId: 'SUP-03', currentStock: 4.0, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  // Dry Goods
  { id: 'ING-15', name: 'Jasmine Rice', category: 'Dry Goods', uom: 'kg', unitCost: 58, supplierId: 'SUP-04', currentStock: 45.0, safetyStock: 15, reorderPoint: 25, reorderQty: 50 },
  { id: 'ING-16', name: 'Bihon (Rice Noodles)', category: 'Dry Goods', uom: 'pack', unitCost: 42, supplierId: 'SUP-04', currentStock: 18, safetyStock: 5, reorderPoint: 10, reorderQty: 24 },
  { id: 'ING-17', name: 'Ground Peanuts', category: 'Dry Goods', uom: 'kg', unitCost: 220, supplierId: 'SUP-04', currentStock: 3.0, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  // Condiments & Seasonings
  { id: 'ING-18', name: 'Cane Vinegar (Sukang Iloko)', category: 'Condiments & Seasonings', uom: 'L', unitCost: 95, supplierId: 'SUP-04', currentStock: 8.0, safetyStock: 2, reorderPoint: 4, reorderQty: 10 },
  { id: 'ING-19', name: 'Soy Sauce', category: 'Condiments & Seasonings', uom: 'L', unitCost: 75, supplierId: 'SUP-04', currentStock: 6.5, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-20', name: 'Bagoong Isda (Fish Paste)', category: 'Condiments & Seasonings', uom: 'kg', unitCost: 180, supplierId: 'SUP-02', currentStock: 2.5, safetyStock: 0.5, reorderPoint: 1, reorderQty: 3 },
  // Dairy & Eggs
  { id: 'ING-21', name: 'Chicken Eggs', category: 'Dairy & Eggs', uom: 'tray', unitCost: 195, supplierId: 'SUP-03', currentStock: 4, safetyStock: 2, reorderPoint: 3, reorderQty: 6 },
  // Packaging
  { id: 'ING-22', name: 'Take-out Containers (500mL)', category: 'Packaging', uom: 'pack', unitCost: 120, supplierId: 'SUP-05', currentStock: 8, safetyStock: 3, reorderPoint: 5, reorderQty: 12 },
  { id: 'ING-23', name: 'Paper Bags (Large)', category: 'Packaging', uom: 'pack', unitCost: 85, supplierId: 'SUP-05', currentStock: 2, safetyStock: 3, reorderPoint: 5, reorderQty: 10 },
    // ── Added for full menu coverage ──
  { id: 'ING-24', name: 'Shrimp (Hipon)', category: 'Proteins', uom: 'kg', unitCost: 450, supplierId: 'SUP-02', currentStock: 6, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-25', name: 'Tuna', category: 'Proteins', uom: 'kg', unitCost: 380, supplierId: 'SUP-02', currentStock: 5, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-26', name: 'Squid (Pusit)', category: 'Proteins', uom: 'kg', unitCost: 300, supplierId: 'SUP-02', currentStock: 4, safetyStock: 2, reorderPoint: 3, reorderQty: 6 },
  { id: 'ING-27', name: 'Beef (Sirloin/Tapa)', category: 'Proteins', uom: 'kg', unitCost: 480, supplierId: 'SUP-01', currentStock: 8, safetyStock: 3, reorderPoint: 6, reorderQty: 10 },
  { id: 'ING-28', name: 'Pork Offal (Bulaklak/Papaitan)', category: 'Proteins', uom: 'kg', unitCost: 160, supplierId: 'SUP-01', currentStock: 5, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-29', name: 'Ham', category: 'Proteins', uom: 'kg', unitCost: 280, supplierId: 'SUP-01', currentStock: 3, safetyStock: 1, reorderPoint: 2, reorderQty: 4 },
  { id: 'ING-30', name: 'Hotdog', category: 'Proteins', uom: 'pack', unitCost: 95, supplierId: 'SUP-01', currentStock: 6, safetyStock: 2, reorderPoint: 4, reorderQty: 10 },
  { id: 'ING-31', name: 'Longganisa', category: 'Proteins', uom: 'pack', unitCost: 130, supplierId: 'SUP-01', currentStock: 6, safetyStock: 2, reorderPoint: 4, reorderQty: 10 },
  { id: 'ING-32', name: 'Tokwa (Tofu)', category: 'Proteins', uom: 'pcs', unitCost: 12, supplierId: 'SUP-03', currentStock: 30, safetyStock: 10, reorderPoint: 20, reorderQty: 40 },
  { id: 'ING-33', name: 'Potato', category: 'Produce', uom: 'kg', unitCost: 90, supplierId: 'SUP-03', currentStock: 8, safetyStock: 3, reorderPoint: 5, reorderQty: 10 },
  { id: 'ING-34', name: 'Cabbage', category: 'Produce', uom: 'kg', unitCost: 50, supplierId: 'SUP-03', currentStock: 6, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-35', name: 'Cucumber', category: 'Produce', uom: 'kg', unitCost: 60, supplierId: 'SUP-03', currentStock: 4, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  { id: 'ING-36', name: 'Broccoli', category: 'Produce', uom: 'kg', unitCost: 180, supplierId: 'SUP-03', currentStock: 3, safetyStock: 1, reorderPoint: 2, reorderQty: 4 },
  { id: 'ING-37', name: 'Mixed Vegetables', category: 'Produce', uom: 'kg', unitCost: 90, supplierId: 'SUP-03', currentStock: 8, safetyStock: 3, reorderPoint: 5, reorderQty: 10 },
  { id: 'ING-38', name: 'Mango', category: 'Produce', uom: 'kg', unitCost: 120, supplierId: 'SUP-03', currentStock: 6, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-39', name: 'Pineapple', category: 'Produce', uom: 'kg', unitCost: 60, supplierId: 'SUP-03', currentStock: 6, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-40', name: 'Buko (Young Coconut)', category: 'Produce', uom: 'pcs', unitCost: 35, supplierId: 'SUP-03', currentStock: 20, safetyStock: 6, reorderPoint: 10, reorderQty: 24 },
  { id: 'ING-41', name: 'Chili (Siling Labuyo)', category: 'Produce', uom: 'kg', unitCost: 200, supplierId: 'SUP-03', currentStock: 1, safetyStock: 0.3, reorderPoint: 0.5, reorderQty: 2 },
  { id: 'ING-42', name: 'Pancit Canton Noodles', category: 'Dry Goods', uom: 'pack', unitCost: 38, supplierId: 'SUP-04', currentStock: 18, safetyStock: 5, reorderPoint: 10, reorderQty: 24 },
  { id: 'ING-43', name: 'Sotanghon', category: 'Dry Goods', uom: 'pack', unitCost: 40, supplierId: 'SUP-04', currentStock: 18, safetyStock: 5, reorderPoint: 10, reorderQty: 24 },
  { id: 'ING-44', name: 'Egg Noodles (Miki)', category: 'Dry Goods', uom: 'pack', unitCost: 45, supplierId: 'SUP-04', currentStock: 18, safetyStock: 5, reorderPoint: 10, reorderQty: 24 },
  { id: 'ING-45', name: 'Cooking Oil', category: 'Condiments & Seasonings', uom: 'L', unitCost: 110, supplierId: 'SUP-04', currentStock: 20, safetyStock: 6, reorderPoint: 10, reorderQty: 20 },
  { id: 'ING-46', name: 'Sliced Bread', category: 'Dry Goods', uom: 'pack', unitCost: 65, supplierId: 'SUP-04', currentStock: 10, safetyStock: 3, reorderPoint: 5, reorderQty: 12 },
  { id: 'ING-47', name: 'Corn Kernels', category: 'Dry Goods', uom: 'kg', unitCost: 100, supplierId: 'SUP-04', currentStock: 5, safetyStock: 1, reorderPoint: 2, reorderQty: 6 },
  { id: 'ING-48', name: 'Coconut Milk (Gata)', category: 'Condiments & Seasonings', uom: 'L', unitCost: 90, supplierId: 'SUP-04', currentStock: 6, safetyStock: 2, reorderPoint: 3, reorderQty: 8 },
  { id: 'ING-49', name: 'Sugar', category: 'Dry Goods', uom: 'kg', unitCost: 70, supplierId: 'SUP-04', currentStock: 10, safetyStock: 3, reorderPoint: 5, reorderQty: 12 },
  { id: 'ING-50', name: 'Cheese', category: 'Dairy & Eggs', uom: 'kg', unitCost: 320, supplierId: 'SUP-04', currentStock: 3, safetyStock: 1, reorderPoint: 2, reorderQty: 4 },
  { id: 'ING-51', name: 'Condensed Milk', category: 'Dairy & Eggs', uom: 'pcs', unitCost: 60, supplierId: 'SUP-04', currentStock: 12, safetyStock: 4, reorderPoint: 6, reorderQty: 12 },
  { id: 'ING-52', name: 'Soft Drink (Bottled)', category: 'Dry Goods', uom: 'pcs', unitCost: 15, supplierId: 'SUP-04', currentStock: 48, safetyStock: 12, reorderPoint: 24, reorderQty: 48 },
  { id: 'ING-53', name: 'San Miguel Beer', category: 'Dry Goods', uom: 'pcs', unitCost: 45, supplierId: 'SUP-04', currentStock: 48, safetyStock: 12, reorderPoint: 24, reorderQty: 48 },
  { id: 'ING-54', name: 'Iced Tea Powder', category: 'Dry Goods', uom: 'pack', unitCost: 80, supplierId: 'SUP-04', currentStock: 10, safetyStock: 3, reorderPoint: 5, reorderQty: 12 },
  { id: 'ING-55', name: 'Mayonnaise', category: 'Condiments & Seasonings', uom: 'kg', unitCost: 140, supplierId: 'SUP-04', currentStock: 4, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  { id: 'ING-56', name: 'Tilapia (Plapla)', category: 'Proteins', uom: 'kg', unitCost: 180, supplierId: 'SUP-02', currentStock: 6, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
];

const rm = (menuItemId: string, menuItemName: string, lines: [number, number][]): RecipeMapping => ({
  menuItemId,
  menuItemName,
  ingredients: lines.map(([n, qtyPerServing]) => ({
    ingredientId: `ING-${String(n).padStart(2, '0')}`,
    qtyPerServing,
  })),
});

const seedRecipeMappings: RecipeMapping[] = [
  // Soup
  rm('28', 'Mixed Seafood Soup', [[24, 0.1], [26, 0.1], [5, 0.1], [11, 0.03], [12, 0.01], [13, 0.01]]),
  rm('29', 'Cream of Corn', [[47, 0.15], [21, 0.033], [11, 0.03], [12, 0.01]]),
  rm('30', 'Chicken w/ Corn', [[4, 0.25], [47, 0.1], [21, 0.033], [12, 0.01]]),
  rm('31', 'Sotanghon Soup', [[43, 0.5], [4, 0.1], [11, 0.02], [12, 0.01]]),
  rm('32', 'Papaitan', [[28, 0.3], [13, 0.02], [12, 0.02], [41, 0.01], [11, 0.05]]),
  // Dry Dishes
  rm('33', 'Fried Chicken (Half)', [[4, 0.5], [45, 0.05], [12, 0.01]]),
  rm('34', 'Garlic Chicken (Half)', [[4, 0.5], [12, 0.05], [45, 0.05]]),
  rm('35', 'Chicken Wings', [[4, 0.4], [45, 0.05], [19, 0.02]]),
  rm('36', 'Lumpiang Shanghai', [[2, 0.2], [37, 0.05], [11, 0.03], [21, 0.033], [45, 0.08]]),
  rm('37', 'Calamares', [[26, 0.25], [45, 0.1], [21, 0.033]]),
  rm('38', 'Sashimi Tuna', [[25, 0.25], [19, 0.02], [13, 0.01]]),
  // Pulutan
  rm('39', 'Chicharong Bulaklak', [[28, 0.3], [45, 0.15]]),
  rm('40', 'Adobong Belly', [[1, 0.25], [18, 0.05], [19, 0.03], [12, 0.03]]),
  rm('41', 'French Fries', [[33, 0.3], [45, 0.1]]),
  rm('42', 'Pork Asado', [[2, 0.25], [19, 0.05], [49, 0.02]]),
  // Sizzling
  rm('43', 'Sizzling Sisig', [[1, 0.2], [11, 0.05], [41, 0.01], [21, 0.033], [12, 0.01]]),
  rm('44', 'Sizzling Sisig Bangus', [[5, 0.3], [11, 0.05], [41, 0.01], [21, 0.033]]),
  rm('45', 'Sizzling Beef', [[27, 0.25], [11, 0.05], [19, 0.03], [12, 0.01]]),
  rm('46', 'Sizzling Gambas', [[24, 0.25], [12, 0.03], [41, 0.01], [45, 0.08]]),
  rm('47', 'Sizzling Tokwa', [[32, 2], [2, 0.1], [11, 0.05], [19, 0.02]]),
  // Noodles
  rm('48', 'Bihon Guisado', [[16, 0.5], [2, 0.08], [37, 0.1], [19, 0.02]]),
  rm('49', 'Pancit Canton Guisado', [[42, 0.5], [2, 0.08], [37, 0.1], [19, 0.02]]),
  rm('50', 'Sotanghon Guisado', [[43, 0.5], [2, 0.08], [37, 0.1], [19, 0.02]]),
  rm('51', 'Lomi', [[44, 0.5], [2, 0.1], [21, 0.033], [11, 0.03], [19, 0.02]]),
  rm('52', 'Beef Mami', [[44, 0.5], [27, 0.12], [11, 0.03], [12, 0.01]]),
  // Pancit sa Bilao
  rm('53', 'Small Bilao (Regular)', [[16, 2], [2, 0.3], [37, 0.4], [19, 0.05]]),
  rm('54', 'Small Bilao (Special)', [[16, 2], [2, 0.3], [24, 0.2], [37, 0.4], [19, 0.05]]),
  rm('55', 'Large Bilao (Regular)', [[16, 4], [2, 0.6], [37, 0.8], [19, 0.1]]),
  rm('56', 'Large Bilao (Special)', [[16, 4], [2, 0.6], [24, 0.4], [37, 0.8], [19, 0.1]]),
  // Sandwiches
  rm('57', 'Cheese Sandwich', [[46, 0.1], [50, 0.05], [55, 0.02]]),
  rm('58', 'Clubhouse', [[46, 0.15], [29, 0.05], [50, 0.05], [21, 0.033], [4, 0.1], [55, 0.03]]),
  rm('59', 'Cheese Egg Sandwich', [[46, 0.1], [50, 0.05], [21, 0.033]]),
  rm('60', 'Ham & Egg Sandwich', [[46, 0.1], [29, 0.06], [21, 0.033]]),
  rm('61', 'Hotdog Cheese', [[30, 0.15], [50, 0.04]]),
  // Pulutan / sides
  rm('62', "Tokwa't Baboy", [[32, 3], [1, 0.2], [18, 0.03], [19, 0.03], [11, 0.03], [45, 0.08]]),
  rm('63', 'Chicken Lollipop', [[4, 0.3], [45, 0.1], [21, 0.033]]),
  rm('64', 'Coleslaw', [[34, 0.15], [55, 0.03]]),
  rm('65', 'Cucumber', [[35, 0.2]]),
  // Beverages
  rm('66', 'Pineapple Juice', [[39, 0.2], [49, 0.02]]),
  rm('67', 'Mango Juice', [[38, 0.25], [49, 0.02]]),
  rm('69', 'Soft Drinks (Bottled)', [[52, 1]]),
  rm('70', 'San Miguel Beer', [[53, 1]]),
  rm('143', 'Iced Tea', [[54, 0.1], [49, 0.03]]),
  // Rice
  rm('71', 'Plain Rice', [[15, 0.15]]),
  rm('72', 'Fried Rice', [[15, 0.15], [21, 0.033], [12, 0.01], [45, 0.02]]),
  rm('73', 'Bagoong Rice', [[15, 0.15], [20, 0.03], [12, 0.01]]),
  rm('74', 'Beef Fried Rice', [[15, 0.15], [27, 0.08], [21, 0.033], [12, 0.01]]),
  rm('75', 'Shrimp Fried Rice', [[15, 0.15], [24, 0.08], [21, 0.033], [12, 0.01]]),
  // Native Dishes
  rm('76', 'Bulalo Special', [[3, 0.4], [11, 0.05], [12, 0.02], [34, 0.1]]),
  rm('77', 'Sinigang na Baboy', [[2, 0.35], [14, 0.08], [7, 0.5], [8, 0.05]]),
  rm('78', 'Kare Kare', [[6, 0.3], [17, 0.06], [7, 0.4], [20, 0.02]]),
  rm('79', 'Adobong Baboy', [[1, 0.2], [12, 0.03], [18, 0.06], [19, 0.03]]),
  rm('80', 'Bicol Express', [[1, 0.2], [48, 0.1], [41, 0.02], [20, 0.02]]),
  // Dishes
  rm('81', 'Aling Nene Hot Pot', [[1, 0.1], [4, 0.1], [24, 0.08], [37, 0.15]]),
  rm('82', 'Hongkong Chicken (Half)', [[4, 0.5], [19, 0.03], [45, 0.08]]),
  rm('83', 'Beef Brocoli', [[27, 0.2], [36, 0.15], [12, 0.01], [19, 0.02]]),
  rm('84', 'Lechon Kawali', [[1, 0.25], [45, 0.1]]),
  rm('85', 'Chopsuey', [[37, 0.25], [4, 0.05], [24, 0.05], [12, 0.01]]),
  // Toppings (rice meals)
  rm('86', 'Aling Nene Rice', [[15, 0.15], [1, 0.08], [4, 0.08], [21, 0.033]]),
  rm('87', 'Menudo Rice', [[15, 0.15], [2, 0.1], [33, 0.05], [11, 0.02]]),
  rm('88', 'Amp. Asado Rice', [[15, 0.15], [2, 0.1], [19, 0.02]]),
  rm('89', 'Beef Rice', [[15, 0.15], [27, 0.1]]),
  rm('90', 'Beef Brocoli Rice', [[15, 0.15], [27, 0.1], [36, 0.08]]),
  // Specialties (silog)
  rm('91', 'Tapsilog', [[15, 0.15], [27, 0.12], [21, 0.033], [12, 0.01]]),
  rm('92', 'Porksilog', [[15, 0.15], [2, 0.12], [21, 0.033], [12, 0.01]]),
  rm('93', 'Longsilog', [[15, 0.15], [31, 0.15], [21, 0.033]]),
  rm('94', 'Tosilog', [[15, 0.15], [2, 0.12], [49, 0.01], [21, 0.033]]),
  rm('95', 'Hotsilog', [[15, 0.15], [30, 0.15], [21, 0.033]]),
  // Fish
  rm('96', 'Fried Plapla', [[56, 0.35], [45, 0.1]]),
  rm('97', 'Fried Boneless Bangus', [[5, 0.35], [45, 0.08]]),
  rm('98', 'Steamed Plapla w/ Mayo', [[56, 0.35], [55, 0.04]]),
  rm('99', 'Steamed Plapla w/ Sauce', [[56, 0.35], [19, 0.03], [13, 0.02], [11, 0.03]]),
  rm('100', 'Crispy Buntot ng Tuna', [[25, 0.4], [45, 0.12]]),
  // Desserts
  rm('101', 'Buko Salad', [[40, 0.5], [51, 0.1]]),
  rm('102', 'Leche Plan', [[21, 0.2], [51, 0.5], [49, 0.03]]),
];

const seedVarianceRecords: VarianceRecord[] = [
  { id: 'VAR-001', ingredientId: 'ING-01', date: new Date(Date.now() - 2 * 86400000), theoreticalQty: 14.2, actualQty: 13.5, variance: -0.7, reason: 'portion_drift', flagged: true },
  { id: 'VAR-002', ingredientId: 'ING-05', date: new Date(Date.now() - 86400000), theoreticalQty: 5.1, actualQty: 4.5, variance: -0.6, reason: 'spoilage', flagged: true },
  { id: 'VAR-003', ingredientId: 'ING-15', date: new Date(Date.now() - 3 * 86400000), theoreticalQty: 46.0, actualQty: 45.5, variance: -0.5, reason: 'shrinkage', flagged: false },
];

const seedPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-001',
    supplierId: 'SUP-01',
    status: 'Received',
    lineItems: [
      { ingredientId: 'ING-01', orderedQty: 20, receivedQty: 20, unitCost: 380 },
      { ingredientId: 'ING-03', orderedQty: 12, receivedQty: 12, unitCost: 520 },
    ],
    createdAt: new Date(Date.now() - 5 * 86400000),
    expectedAt: new Date(Date.now() - 3 * 86400000),
    receivedAt: new Date(Date.now() - 3 * 86400000),
    total: 20 * 380 + 12 * 520,
  },
  {
    id: 'PO-002',
    supplierId: 'SUP-03',
    status: 'Sent',
    lineItems: [
      { ingredientId: 'ING-07', orderedQty: 20, receivedQty: 0, unitCost: 25 },
      { ingredientId: 'ING-10', orderedQty: 6, receivedQty: 0, unitCost: 55 },
      { ingredientId: 'ING-11', orderedQty: 8, receivedQty: 0, unitCost: 90 },
    ],
    createdAt: new Date(Date.now() - 86400000),
    expectedAt: new Date(Date.now() + 86400000),
    total: 20 * 25 + 6 * 55 + 8 * 90,
  },
];

// ─── Store (Angular service) ──────────────────────────────────────────────────

export function stockStatus(ing: Ingredient): StockStatus {
  if (ing.currentStock < ing.safetyStock) return 'Critical';
  if (ing.currentStock < ing.reorderPoint) return 'Low';
  return 'Good';
}

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  // state, read as ingredients(), suppliers(), etc.
  readonly suppliers = signal<Supplier[]>(suppliers);
  readonly ingredients = signal<Ingredient[]>(seedIngredients);
  readonly recipeMappings = signal<RecipeMapping[]>(seedRecipeMappings);
  readonly varianceRecords = signal<VarianceRecord[]>(seedVarianceRecords);
  readonly purchaseOrders = signal<PurchaseOrder[]>(seedPurchaseOrders);

  private deductionLog: { billId: string; at: Date; deductions: { ingredientId: string; qty: number }[] }[] = [];

  // so templates can call inventory.stockStatus(ing)
  readonly stockStatus = stockStatus;

  saveIngredient(ing: Ingredient) {
    this.ingredients.update(list => {
      const exists = list.some(i => i.id === ing.id);
      return exists ? list.map(i => (i.id === ing.id ? ing : i)) : [ing, ...list];
    });
  }

  saveRecipeMapping(mapping: RecipeMapping) {
    this.recipeMappings.update(list => {
      const exists = list.some(r => r.menuItemId === mapping.menuItemId);
      return exists ? list.map(r => (r.menuItemId === mapping.menuItemId ? mapping : r)) : [mapping, ...list];
    });
  }

  // Called by BillSettlement after payment — deducts ingredients for each sold item
  deductStockForBill(billId: string, items: { menuItemId: string; quantity: number }[]) {
    if (this.deductionLog.some(d => d.billId === billId)) return; // idempotent

    const deductions: { ingredientId: string; qty: number }[] = [];
    items.forEach(({ menuItemId, quantity }) => {
      const recipe = this.recipeMappings().find(r => r.menuItemId === menuItemId);
      if (!recipe) return;
      recipe.ingredients.forEach(ri => {
        deductions.push({ ingredientId: ri.ingredientId, qty: ri.qtyPerServing * quantity });
      });
    });

    this.ingredients.update(list =>
      list.map(ing => {
        const totalDeducted = deductions
          .filter(d => d.ingredientId === ing.id)
          .reduce((s, d) => s + d.qty, 0);
        return totalDeducted > 0
          ? { ...ing, currentStock: Math.max(0, +(ing.currentStock - totalDeducted).toFixed(3)) }
          : ing;
      }),
    );

    this.deductionLog.push({ billId, at: new Date(), deductions });
  }

  logVariance(record: Omit<VarianceRecord, 'id'>) {
    const rec: VarianceRecord = { ...record, id: `VAR-${Date.now().toString(36).toUpperCase().slice(-4)}` };
    this.varianceRecords.update(list => [rec, ...list]);
  }

  createPO(supplierId: string, lineItems: POLineItem[], expectedAt: Date, notes?: string): PurchaseOrder {
    const total = lineItems.reduce((s, li) => s + li.orderedQty * li.unitCost, 0);
    const po: PurchaseOrder = {
      id: `PO-${String(this.purchaseOrders().length + 1).padStart(3, '0')}`,
      supplierId,
      lineItems,
      expectedAt,
      notes,
      total,
      status: 'Draft',
      createdAt: new Date(),
    };
    this.purchaseOrders.update(list => [po, ...list]);
    return po;
  }

  receivePO(poId: string, received: { ingredientId: string; receivedQty: number }[]) {
    this.purchaseOrders.update(list =>
      list.map(po => {
        if (po.id !== poId) return po;
        const updatedLines = po.lineItems.map(li => {
          const r = received.find(x => x.ingredientId === li.ingredientId);
          return r ? { ...li, receivedQty: li.receivedQty + r.receivedQty } : li;
        });
        const allReceived = updatedLines.every(li => li.receivedQty >= li.orderedQty);
        const anyReceived = updatedLines.some(li => li.receivedQty > 0);
        return {
          ...po,
          lineItems: updatedLines,
          status: allReceived ? 'Received' : anyReceived ? 'Partial' : po.status,
          receivedAt: anyReceived ? new Date() : po.receivedAt,
        } as PurchaseOrder;
      }),
    );

    // Increment stock levels
    this.ingredients.update(list =>
      list.map(ing => {
        const r = received.find(x => x.ingredientId === ing.id);
        return r ? { ...ing, currentStock: +(ing.currentStock + r.receivedQty).toFixed(3) } : ing;
      }),
    );
  }
}