export interface Module9Ingredient {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  lowStockThreshold: number;
}

export interface Module9RecipeIngredient {
  ingredientId: string;
  requiredQuantity: number;
}

export interface Module9MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  recipe: Module9RecipeIngredient[];
}

export interface Module9MenuStatus extends Module9MenuItem {
  isAvailable: boolean;
  blockingIngredients: { ingredientId: string; name: string; stock: number; required: number }[];
}

export interface Module9StockSignal {
  id: string;
  ingredientId: string;
  previousStock: number;
  currentStock: number;
  receivedAt: Date;
  source: 'Module 18';
}

export interface Module9AvailabilityEvent {
  id: string;
  menuItemId: string;
  menuItemName: string;
  ingredientId: string;
  ingredientName: string;
  eventType: 'suppressed' | 'restored';
  previousStock: number;
  currentStock: number;
  eventTime: Date;
  stockSignalId: string;
}
