export interface Module7TicketItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
}

export interface Module7ActiveTicket {
  id: string;
  location: string;
  receivedAt: Date;
  targetServeAt: Date;
  items: Module7TicketItem[];
}

export interface Module7CategoryBenchmark {
  category: string;
  prepMinutes: number;
}

export interface Module7FireRecommendation {
  ticketId: string;
  itemId: string;
  itemName: string;
  category: string;
  quantity: number;
  prepMinutes: number;
  targetServeAt: Date;
  recommendedStartAt: Date;
  rank: number;
  actualStartAt?: Date;
  followed?: boolean;
}

export interface Module7ComplianceLog {
  id: string;
  ticketId: string;
  itemName: string;
  recommendedStartAt: Date;
  actualStartAt: Date;
  followed: boolean;
  recordedAt: Date;
}
