export interface Module8MenuItem {
  id: string;
  name: string;
  category: string;
  ingredients: string[];
  price: number;
  isAvailable: boolean;
}

export type Module8RuleType = 'exclude-item' | 'exclude-substitute' | 'preferred-substitute';

export interface Module8ConfigRule {
  id: string;
  unavailableMenuItemId: string;
  ruleType: Module8RuleType;
  targetMenuItemId?: string;
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
  id: string;
  unavailableMenuItemId: string;
  suggestedMenuItemId: string;
  rank: number;
  shownAt: Date;
  accepted: boolean | null;
}

export interface Module8UnavailableEvent {
  id: string;
  menuItemId: string;
  occurredAt: Date;
  source: 'Module 9';
}
