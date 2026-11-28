import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IngredientCategory = 'Proteins' | 'Produce' | 'Dry Goods' | 'Condiments & Seasonings' | 'Dairy & Eggs' | 'Packaging';
export type UOM = 'kg' | 'g' | 'L' | 'mL' | 'pcs' | 'pack' | 'tray' | 'bundle';
export type StockStatus = 'Good' | 'Low' | 'Critical';
export type POStatus = 'Draft' | 'Sent' | 'Received' | 'Partial';
export type VarianceReason = 'spoilage' | 'shrinkage' | 'portion_drift' | 'theft' | 'damaged' | 'unaccounted';

export interface VarianceResult {
  lineIndex: number;
  ingredientId: string;
  theoreticalQty: number;
  physicalCount: number;
  variance: number;
  variancePct: number;
  tolerancePct: number;
  flagged: boolean;
}

export interface ReceiveEntry {
  qty: number;
  physicalCount: number | null;
}

export const DEFAULT_TOLERANCES: Record<string, number> = {
  'Proteins': 3, 'Produce': 8, 'Dry Goods': 2,
  'Condiments & Seasonings': 5, 'Dairy & Eggs': 5, 'Packaging': 3,
};

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  uom: UOM;
  unitCost: number;
  supplierId: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  reorderQty: number;
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
  qtyPerServing: number;
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
  variancePct: number;
  tolerancePct: number;
  reason?: VarianceReason;
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
  { id: 'ING-01', name: 'Pork Belly (Liempo)', category: 'Proteins', uom: 'kg', unitCost: 380, supplierId: 'SUP-01', currentStock: 12.5, safetyStock: 5, reorderPoint: 10, reorderQty: 20 },
  { id: 'ING-02', name: 'Pork Shoulder (Kasim)', category: 'Proteins', uom: 'kg', unitCost: 320, supplierId: 'SUP-01', currentStock: 3.2, safetyStock: 4, reorderPoint: 8, reorderQty: 15 },
  { id: 'ING-03', name: 'Beef Shank (Bulalo Cut)', category: 'Proteins', uom: 'kg', unitCost: 520, supplierId: 'SUP-01', currentStock: 8.0, safetyStock: 3, reorderPoint: 6, reorderQty: 12 },
  { id: 'ING-04', name: 'Whole Chicken', category: 'Proteins', uom: 'kg', unitCost: 210, supplierId: 'SUP-01', currentStock: 15.0, safetyStock: 6, reorderPoint: 10, reorderQty: 20 },
  { id: 'ING-05', name: 'Bangus (Milkfish)', category: 'Proteins', uom: 'kg', unitCost: 250, supplierId: 'SUP-02', currentStock: 4.5, safetyStock: 3, reorderPoint: 6, reorderQty: 10 },
  { id: 'ING-06', name: 'Oxtail', category: 'Proteins', uom: 'kg', unitCost: 580, supplierId: 'SUP-01', currentStock: 5.0, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-07', name: 'Kangkong (Water Spinach)', category: 'Produce', uom: 'bundle', unitCost: 25, supplierId: 'SUP-03', currentStock: 8, safetyStock: 5, reorderPoint: 10, reorderQty: 20 },
  { id: 'ING-08', name: 'Sitaw (String Beans)', category: 'Produce', uom: 'kg', unitCost: 60, supplierId: 'SUP-03', currentStock: 2.0, safetyStock: 1, reorderPoint: 3, reorderQty: 5 },
  { id: 'ING-09', name: 'Green Papaya', category: 'Produce', uom: 'kg', unitCost: 35, supplierId: 'SUP-03', currentStock: 6.0, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-10', name: 'Eggplant (Talong)', category: 'Produce', uom: 'kg', unitCost: 55, supplierId: 'SUP-03', currentStock: 1.5, safetyStock: 2, reorderPoint: 4, reorderQty: 6 },
  { id: 'ING-11', name: 'White Onion', category: 'Produce', uom: 'kg', unitCost: 90, supplierId: 'SUP-03', currentStock: 5.0, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-12', name: 'Garlic', category: 'Produce', uom: 'kg', unitCost: 150, supplierId: 'SUP-03', currentStock: 3.5, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  { id: 'ING-13', name: 'Ginger (Luya)', category: 'Produce', uom: 'kg', unitCost: 110, supplierId: 'SUP-03', currentStock: 2.0, safetyStock: 0.5, reorderPoint: 1, reorderQty: 3 },
  { id: 'ING-14', name: 'Tamarind (Sampalok)', category: 'Produce', uom: 'kg', unitCost: 80, supplierId: 'SUP-03', currentStock: 4.0, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  { id: 'ING-15', name: 'Jasmine Rice', category: 'Dry Goods', uom: 'kg', unitCost: 58, supplierId: 'SUP-04', currentStock: 45.0, safetyStock: 15, reorderPoint: 25, reorderQty: 50 },
  { id: 'ING-16', name: 'Bihon (Rice Noodles)', category: 'Dry Goods', uom: 'pack', unitCost: 42, supplierId: 'SUP-04', currentStock: 18, safetyStock: 5, reorderPoint: 10, reorderQty: 24 },
  { id: 'ING-17', name: 'Ground Peanuts', category: 'Dry Goods', uom: 'kg', unitCost: 220, supplierId: 'SUP-04', currentStock: 3.0, safetyStock: 1, reorderPoint: 2, reorderQty: 5 },
  { id: 'ING-18', name: 'Cane Vinegar (Sukang Iloko)', category: 'Condiments & Seasonings', uom: 'L', unitCost: 95, supplierId: 'SUP-04', currentStock: 8.0, safetyStock: 2, reorderPoint: 4, reorderQty: 10 },
  { id: 'ING-19', name: 'Soy Sauce', category: 'Condiments & Seasonings', uom: 'L', unitCost: 75, supplierId: 'SUP-04', currentStock: 6.5, safetyStock: 2, reorderPoint: 4, reorderQty: 8 },
  { id: 'ING-20', name: 'Bagoong Isda (Fish Paste)', category: 'Condiments & Seasonings', uom: 'kg', unitCost: 180, supplierId: 'SUP-02', currentStock: 2.5, safetyStock: 0.5, reorderPoint: 1, reorderQty: 3 },
  { id: 'ING-21', name: 'Chicken Eggs', category: 'Dairy & Eggs', uom: 'tray', unitCost: 195, supplierId: 'SUP-03', currentStock: 4, safetyStock: 2, reorderPoint: 3, reorderQty: 6 },
  { id: 'ING-22', name: 'Take-out Containers (500mL)', category: 'Packaging', uom: 'pack', unitCost: 120, supplierId: 'SUP-05', currentStock: 8, safetyStock: 3, reorderPoint: 5, reorderQty: 12 },
  { id: 'ING-23', name: 'Paper Bags (Large)', category: 'Packaging', uom: 'pack', unitCost: 85, supplierId: 'SUP-05', currentStock: 2, safetyStock: 3, reorderPoint: 5, reorderQty: 10 },
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
  if (ing.currentStock <= ing.safetyStock) return 'Critical';
  if (ing.currentStock <= ing.reorderPoint) return 'Low';
  return 'Good';
}

type DeductionLogEntry = {
  key: string;
  at: Date;
  deductions: { ingredientId: string; qty: number }[];
};

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private sb = inject(SupabaseService).client;

  readonly suppliers = signal<Supplier[]>(suppliers);
  readonly ingredients = signal<Ingredient[]>(seedIngredients);
  readonly recipeMappings = signal<RecipeMapping[]>([]);
  readonly varianceRecords = signal<VarianceRecord[]>([]);
  readonly purchaseOrders = signal<PurchaseOrder[]>(seedPurchaseOrders);
  readonly tolerances = signal<Record<string, number>>({ ...DEFAULT_TOLERANCES });

  private deductionLog: DeductionLogEntry[] = [];

  readonly stockStatus = stockStatus;

  constructor() {
    this.loadIngredients();
    this.loadRecipeMappings();
    this.loadVarianceRecords();
  }

  // ─── LOAD DATA FROM SUPABASE ───

  async loadIngredients() {
    const { data, error } = await this.sb.from('ingredients').select('*');
    if (error) { console.error('Error loading ingredients:', error); return; }
    
    if (data && data.length > 0) {
      this.ingredients.update(current => current.map(seedIng => {
        const dbIng = data.find(d => d.id === seedIng.id);
        if (dbIng) {
          return { 
            ...seedIng, 
            currentStock: Number(dbIng.current_stock),
            unitCost: Number(dbIng.unit_cost),
            safetyStock: Number(dbIng.safety_stock),
            reorderPoint: Number(dbIng.reorder_point),
            reorderQty: Number(dbIng.reorder_qty)
          };
        }
        return seedIng;
      }));
    }
  }

  async loadRecipeMappings() {
    const { data, error } = await this.sb.from('recipe_mappings').select(`
      menu_id, menu_name, recipe_item ( ingredient_id, required_quantity )
    `);

    if (error) { console.error('Error loading recipes:', error); return; }

    if (data && data.length > 0) {
      this.recipeMappings.set(data.map((r: any) => ({
        menuItemId: String(r.menu_id),
        menuItemName: r.menu_name,
        ingredients: (r.recipe_item || []).map((ri: any) => ({
          ingredientId: ri.ingredient_id,
          qtyPerServing: Number(ri.required_quantity)
        }))
      })));
    }
  }

  async loadVarianceRecords() {
    const { data, error } = await this.sb.from('inventory_audits').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error loading audits:', error); return; }
    
    if (data) {
      this.varianceRecords.set(data.map((r: any) => ({
        id: r.id,
        ingredientId: r.ingredient_id,
        poId: r.po_id,
        theoreticalQty: Number(r.theoretical_qty),
        actualQty: Number(r.actual_qty),
        variance: Number(r.variance),
        variancePct: Number(r.variance_pct),
        tolerancePct: Number(r.tolerance_pct),
        flagged: r.flagged,
        reason: r.reason as VarianceReason | undefined,
        date: new Date(r.created_at)
      })));
    }
  }

  // ─── SAVE DATA TO SUPABASE ───

  async saveIngredient(ing: Ingredient) {
    this.ingredients.update(list => {
      const exists = list.some(i => i.id === ing.id);
      return exists ? list.map(i => (i.id === ing.id ? ing : i)) : [ing, ...list];
    });

    await this.sb.from('ingredients').upsert({
      id: ing.id, name: ing.name, category: ing.category, uom: ing.uom,
      unit_cost: ing.unitCost, supplier_id: ing.supplierId, current_stock: ing.currentStock,
      safety_stock: ing.safetyStock, reorder_point: ing.reorderPoint, reorder_qty: ing.reorderQty
    });
  }

  async saveRecipeMapping(mapping: RecipeMapping) {
    this.recipeMappings.update(list => {
      const exists = list.some(r => r.menuItemId === mapping.menuItemId);
      return exists ? list.map(r => (r.menuItemId === mapping.menuItemId ? mapping : r)) : [mapping, ...list];
    });

    await this.sb.from('recipe_mappings').upsert({
      menu_id: mapping.menuItemId, menu_name: mapping.menuItemName
    }, { onConflict: 'menu_id' });

    await this.sb.from('recipe_item').delete().eq('menu_id', mapping.menuItemId);

    if (mapping.ingredients.length > 0) {
      await this.sb.from('recipe_item').insert(mapping.ingredients.map(ri => ({
        menu_id: mapping.menuItemId, ingredient_id: ri.ingredientId, required_quantity: ri.qtyPerServing
      })));
    }
  }

  async updateVarianceReason(id: string, reason?: VarianceReason) {
    this.varianceRecords.update(list => list.map(v => (v.id === id ? { ...v, reason } : v)));
    await this.sb.from('inventory_audits').update({ reason: reason || null }).eq('id', id);
  }

  // ─── STOCK DEDUCTION ───

  deductStockForBill(key: string, items: { menuItemId: string | number; quantity: number }[]): { ingredientId: string; qty: number }[] {
    if (this.deductionLog.some(d => d.key === key)) return [];
    if (!key || !items || items.length === 0) return [];

    const mappings = this.recipeMappings();
    const deductions: { ingredientId: string; qty: number }[] = [];
    const missing: (string | number)[] = [];

    for (const { menuItemId, quantity } of items) {
      const recipe = mappings.find(r => String(r.menuItemId) === String(menuItemId));
      if (!recipe) { missing.push(menuItemId); continue; }
      
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      for (const ri of recipe.ingredients) {
        deductions.push({ ingredientId: ri.ingredientId, qty: ri.qtyPerServing * qty });
      }
    }

    if (missing.length) console.warn(`[deduct] NO RECIPE MAPPING for menuItemId(s):`, missing.join(', '));
    if (deductions.length === 0) return [];

    const totals = new Map<string, number>();
    for (const d of deductions) {
      totals.set(d.ingredientId, (totals.get(d.ingredientId) ?? 0) + d.qty);
    }

    const dbUpdates: any[] = [];

    this.ingredients.update(list =>
      list.map(ing => {
        const delta = totals.get(ing.id);
        if (!delta) return ing;
        
        const next = Math.max(0, +(ing.currentStock - delta).toFixed(3));
        console.log(`[deduct] ${ing.name}: ${ing.currentStock} → ${next} (−${delta.toFixed(3)} ${ing.uom})`);
        
        dbUpdates.push({ id: ing.id, current_stock: next });
        return { ...ing, currentStock: next };
      }),
    );

    if (dbUpdates.length > 0) {
      Promise.all(dbUpdates.map(u => 
        this.sb.from('ingredients').update({ current_stock: u.current_stock }).eq('id', u.id)
      )).then(results => {
        const error = results.find(r => r.error)?.error;
        if (error) console.error('Failed to save deductions to DB', error);
      });
    }

    this.deductionLog.push({ key, at: new Date(), deductions });
    return deductions;
  }

  // ─── UTILS & PO MANAGEMENT ───

  toleranceFor(category: string): number {
    return this.tolerances()[category] ?? 5;
  }

  setTolerance(category: string, pct: number) {
    const v = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
    this.tolerances.update(t => ({ ...t, [category]: v }));
  }

  receivePOWithCount(poId: string, entries: ReceiveEntry[]): VarianceResult[] {
    const po = this.purchaseOrders().find(p => p.id === poId);
    if (!po) return [];

    const lineItems = po.lineItems.map((l, i) => ({
      ...l,
      receivedQty: l.receivedQty + Math.max(0, entries[i]?.qty ?? 0),
    }));
    const complete = lineItems.every(l => l.receivedQty >= l.orderedQty);
    const status: POStatus = complete ? 'Received' : 'Partial';
    this.purchaseOrders.update(list => list.map(p => (p.id === poId ? { ...p, lineItems, status, receivedAt: new Date() } : p)));

    const stock = new Map(this.ingredients().map(i => [i.id, i.currentStock]));
    const touched = new Set<string>();
    const results: VarianceResult[] = [];
    const recordsToInsert: any[] = [];
    let seq = this.varianceRecords().length;

    po.lineItems.forEach((line, i) => {
      const ing = this.ingredients().find(x => x.id === line.ingredientId);
      if (!ing) return;
      
      const received = Math.max(0, entries[i]?.qty ?? 0);
      const physical = entries[i]?.physicalCount;
      const theoretical = stock.get(ing.id) ?? 0;
      
      // Default: System + Received
      let newStock = theoretical + received; 

      if (physical !== null && physical !== undefined && Number.isFinite(physical) && physical >= 0) {
        const variance = +(physical - theoretical).toFixed(3);
        const variancePct = theoretical > 0 ? (Math.abs(variance) / theoretical) * 100 : variance !== 0 ? 100 : 0;
        const tolerancePct = this.toleranceFor(ing.category);
        const flagged = variancePct > tolerancePct;
        
        seq += 1;
        const newId = `VAR-${Date.now().toString(36).toUpperCase().slice(-4)}-${seq}`;
        
        recordsToInsert.push({
          id: newId, ingredient_id: ing.id, po_id: poId,
          theoretical_qty: theoretical, actual_qty: physical,
          variance, variance_pct: variancePct, tolerance_pct: tolerancePct,
          flagged
        });

        results.push({ lineIndex: i, ingredientId: ing.id, theoreticalQty: theoretical, physicalCount: physical, variance, variancePct, tolerancePct, flagged });
        
        // THE FIX: If they counted the shelf, the new stock is the physical count PLUS the newly received items
        newStock = physical + received; 
      }
      
      if (received > 0) touched.add(ing.id);
      stock.set(ing.id, +newStock.toFixed(3));
    });

    const dbUpdates: any[] = [];

    this.ingredients.update(list =>
      list.map(ing => {
        if (touched.has(ing.id)) {
          const next = stock.get(ing.id) ?? ing.currentStock;
          dbUpdates.push({ id: ing.id, current_stock: next });
          return { ...ing, currentStock: next };
        }
        return ing;
      }),
    );
    
    if (recordsToInsert.length > 0) {
      this.sb.from('inventory_audits').insert(recordsToInsert).then(() => {
        this.loadVarianceRecords();
      });
    }

    if (dbUpdates.length > 0) {
      Promise.all(dbUpdates.map(u => 
        this.sb.from('ingredients').update({ current_stock: u.current_stock }).eq('id', u.id)
      )).then(results => {
        const error = results.find(r => r.error)?.error;
        if (error) console.error('Failed to save received PO to DB', error);
      });
    }

    return results;
  }

  createPO(supplierId: string, lineItems: POLineItem[], expectedAt: Date, notes?: string): PurchaseOrder {
    const total = lineItems.reduce((s, li) => s + li.orderedQty * li.unitCost, 0);
    const po: PurchaseOrder = {
      id: `PO-${String(this.purchaseOrders().length + 1).padStart(3, '0')}`,
      supplierId, lineItems, expectedAt, notes, total,
      status: 'Draft', createdAt: new Date(),
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
          ...po, lineItems: updatedLines,
          status: allReceived ? 'Received' : anyReceived ? 'Partial' : po.status,
          receivedAt: anyReceived ? new Date() : po.receivedAt,
        } as PurchaseOrder;
      }),
    );

    const dbUpdates: any[] = [];

    this.ingredients.update(list =>
      list.map(ing => {
        const r = received.find(x => x.ingredientId === ing.id);
        if (r) {
          const next = +(ing.currentStock + r.receivedQty).toFixed(3);
          dbUpdates.push({ id: ing.id, current_stock: next });
          return { ...ing, currentStock: next };
        }
        return ing;
      }),
    );

    if (dbUpdates.length > 0) {
      Promise.all(dbUpdates.map(u => 
        this.sb.from('ingredients').update({ current_stock: u.current_stock }).eq('id', u.id)
      )).then(results => {
        const error = results.find(r => r.error)?.error;
        if (error) console.error('Failed to save received PO to DB', error);
      });
    }
  }
}