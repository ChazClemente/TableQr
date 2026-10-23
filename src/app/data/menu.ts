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
export const categories: Category[] = [
  'Soup',
  'Dry Dishes',
  'Pulutan',
  'Sizzling',
  'Noodles',
  'Pancit sa Bilao',
  'Sandwiches',
  'Panghimagas',
  'Beverages',
  'Rice',
  'Native Dishes',
  'Dishes',
  'Toppings',
  'Specialties',
  'Fish',
  'Desserts',
];
