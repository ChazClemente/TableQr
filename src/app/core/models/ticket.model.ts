export type TicketStage = 'Pending' | 'Preparing' | 'Ready' | 'Served';
export type TicketSource = 'QR' | 'POS';
export type TicketCategory =
  | 'SABAW'
  | 'ULAM'
  | 'KANIN & PANSIT'
  | 'PAMPAGANA'
  | 'INUMIN'
  | 'MERIENDA';

export interface KitchenTicketItem {
  name: string;
  quantity: number;
  category: TicketCategory;
}

export interface KitchenTicket {
  id: string;
  source: TicketSource;
  location: string;
  submittedAt: Date;
  stage: TicketStage;
  stageChangedAt: Date;
  benchmarkMinutes: number;
  fireInSeconds: number;
  items: KitchenTicketItem[];
}