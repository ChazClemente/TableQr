export interface Module8MenuItem {
  id: number;
  name: string;
  category: string;
  ingredients: string[];
  price: number;
  isAvailable: boolean;
}

export type Module8RuleType = 'preferred' | 'excluded';

export interface Module8ConfigRule {
  id: number;
  unavailableMenuItemId: number;
  ruleType: Module8RuleType;
  targetMenuItemId: number;
  updatedAt: Date;
}

export interface Module8Suggestion {
  menuItem: Module8MenuItem;
  rank: number;
  preferred: boolean;
  categoryMatch: boolean;
  ingredientMatches: string[];
}

export interface Module8SuggestionLog {
  id: number;
  unavailableMenuItemId: number;
  suggestedMenuItemId: number;
  rank: number;
  shownAt: Date;
  accepted: boolean | null;
}