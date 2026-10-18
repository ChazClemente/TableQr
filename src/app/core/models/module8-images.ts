const U = (id: string) => `https://images.unsplash.com/${id}?w=400&h=300&fit=crop&auto=format`;

const PORK = U('photo-1544025162-d76694265947');
const EGGS = U('photo-1565299624946-b28f40a0ae38');
const SALAD = U('photo-1512621776951-a57141f2eefd');
const SOUP = U('photo-1547592166-23ac45744acd');
const DRINK = U('photo-1544787219-7f47ccb76574');

export const MENU_IMAGES: Record<string, string> = {
  'Bagnet Chicharon': PORK,
  'Empanada Vigan': EGGS,
  'Ensaladang Talong': SALAD,
  'Bulalo Batangas': SOUP,
  'Sinigang na Bangus': U('photo-1565557623262-b51c2513a641'),
  'Tinola na Manok': U('photo-1604908176997-125f25cc6f3d'),
  'Adobong Puti': U('photo-1529042410759-befb1204b468'),
  'Kare-Kare': U('photo-1603360946369-dc9bb6258143'),
  'Lechon Kawali': PORK,
  'Pinakbet Ilocos': SALAD,
  'Sinangag at Itlog': U('photo-1603360946369-dc9bb6258143'),
  'Pansit Bihon Guisado': U('photo-1563245372-f21724e3856d'),
  'Arroz Caldo': U('photo-1604908176997-125f25cc6f3d'),
  'Halo-Halo': U('photo-1488900128323-21503983a07e'),
  'Bibingka': EGGS,
  'Leche Flan': U('photo-1488900128323-21503983a07e'),
  'Salabat': DRINK,
  'Buko Juice': U('photo-1559181567-c3190bba7b50'),
  "Sago't Gulaman": DRINK,
  // test items mo
  'Sizzling Pork Sisig': PORK,
  'Pork BBQ': PORK,
  'Crispy Pata': PORK,
  'Iced Tea': DRINK,
};