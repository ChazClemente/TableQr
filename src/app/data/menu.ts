export type Category = 'Pampagana' | 'Sabaw' | 'Ulam' | 'Kanin & Pansit' | 'Merienda' | 'Inumin';

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

export const menuItems: MenuItem[] = [
  // Pampagana (Starters)
  { id: 'm1', name: 'Bagnet Chicharon', description: 'Crispy Ilocos-style deep-fried pork belly, served with Vigan vinegar dip', price: 185, category: 'Pampagana', available: true, popular: true, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop&auto=format' },
  { id: 'm2', name: 'Empanada Vigan', description: 'Flaky, orange-hued rice flour pastry filled with Vigan longganisa, egg, and bean sprouts', price: 95, category: 'Pampagana', available: true, popular: true, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop&auto=format' },
  { id: 'm3', name: 'Ensaladang Talong', description: 'Grilled eggplant salad with tomatoes, onion, and bagoong isda dressing', price: 75, category: 'Pampagana', available: false, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&auto=format' },

  // Sabaw (Soups)
  { id: 'm4', name: 'Bulalo Batangas', description: 'Slow-simmered beef shank and bone marrow soup with pechay and corn', price: 345, category: 'Sabaw', available: true, popular: true, image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop&auto=format' },
  { id: 'm5', name: 'Sinigang na Bangus', description: 'Milkfish in tamarind broth with kangkong, radish, and sitaw', price: 275, category: 'Sabaw', available: true, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop&auto=format' },
  { id: 'm6', name: 'Tinola na Manok', description: 'Ginger-scented chicken soup with green papaya and malunggay leaves', price: 245, category: 'Sabaw', available: true, image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop&auto=format' },

  // Ulam (Main Dishes)
  { id: 'm7', name: 'Adobong Puti', description: 'Heritage Vigan-style white adobo — no soy sauce, just pork, garlic, and cane vinegar', price: 295, category: 'Ulam', available: true, popular: true, image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400&h=300&fit=crop&auto=format' },
  { id: 'm8', name: 'Kare-Kare', description: 'Oxtail and vegetables in rich ground peanut sauce, served with bagoong alamang', price: 385, category: 'Ulam', available: true, image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&h=300&fit=crop&auto=format' },
  { id: 'm9', name: 'Lechon Kawali', description: 'Crispy pan-fried braised pork belly, liver sauce on the side', price: 325, category: 'Ulam', available: false, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop&auto=format' },
  { id: 'm10', name: 'Pinakbet Ilocos', description: 'Heirloom vegetable medley stir-fried with Vigan bagnet and bagoong isda', price: 225, category: 'Ulam', available: true, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&auto=format' },

  // Kanin & Pansit (Rice & Noodles)
  { id: 'm11', name: 'Sinangag at Itlog', description: 'Garlic fried rice with two sunny-side-up eggs', price: 85, category: 'Kanin & Pansit', available: true, image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&h=300&fit=crop&auto=format' },
  { id: 'm12', name: 'Pansit Bihon Guisado', description: 'Thin rice noodles stir-fried with vegetables and pork, calamansi on the side', price: 175, category: 'Kanin & Pansit', available: true, popular: true, image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&h=300&fit=crop&auto=format' },
  { id: 'm13', name: 'Arroz Caldo', description: 'Ginger rice porridge with chicken, topped with crispy garlic, scallions, and boiled egg', price: 145, category: 'Kanin & Pansit', available: true, image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop&auto=format' },

  // Merienda (Snacks & Desserts)
  { id: 'm14', name: 'Halo-Halo', description: 'Shaved ice with mixed fruits, beans, leche flan, and ube ice cream', price: 155, category: 'Merienda', available: true, popular: true, image: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop&auto=format' },
  { id: 'm15', name: 'Bibingka', description: 'Baked rice cake with salted egg and kesong puti, wrapped in banana leaf', price: 95, category: 'Merienda', available: true, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop&auto=format' },
  { id: 'm16', name: 'Leche Flan', description: 'Classic silky caramel custard made from egg yolks and condensed milk', price: 85, category: 'Merienda', available: false, image: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop&auto=format' },

  // Inumin (Drinks)
  { id: 'm17', name: 'Salabat', description: 'Hot ginger tea with honey and calamansi — a bahay kubo staple', price: 55, category: 'Inumin', available: true, image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=300&fit=crop&auto=format' },
  { id: 'm18', name: 'Buko Juice', description: 'Fresh young coconut water served chilled in the shell', price: 75, category: 'Inumin', available: true, popular: true, image: 'https://images.unsplash.com/photo-1559181567-c3190bba7b50?w=400&h=300&fit=crop&auto=format' },
  { id: 'm19', name: 'Sago\'t Gulaman', description: 'Sweet brown sugar drink with tapioca pearls and jelly strips', price: 65, category: 'Inumin', available: true, image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=300&fit=crop&auto=format' },
];

export const categories: Category[] = ['Pampagana', 'Sabaw', 'Ulam', 'Kanin & Pansit', 'Merienda', 'Inumin'];
