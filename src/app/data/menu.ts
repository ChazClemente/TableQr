export type Category = string; // Now accepts any string from the database

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  available: boolean;
  image: string;
  popular?: boolean;
}