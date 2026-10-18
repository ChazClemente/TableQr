export interface Module9Ingredient {
  id: number;
  name: string;
  currentStock: number;
  unit: string;
  lowStockThreshold: number;
  updatedAt: Date;
}

export interface Module9RecipeIngredient {
  ingredientId: number;
  requiredQuantity: number;
}

export interface Module9MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  recipe: Module9RecipeIngredient[];
}

export interface Module9MenuStatus extends Module9MenuItem {
  isAvailable: boolean;
  blockingIngredients: { ingredientId: number; name: string; stock: number; required: number }[];
}

export interface Module9AvailabilityEvent {
  id: number;
  menuItemId: number;
  menuItemName: string;
  ingredientId: number | null;
  ingredientName: string;
  eventType: 'suppressed' | 'restored';
  eventTime: Date;
}