export interface Module10OrderTimestampEvent {
  orderId: string;
  occurredAt: Date;
  source: 'Module 6' | 'Sample history';
}

export interface Module10HourlyVolume {
  hourStart: Date;
  orderCount: number;
  finalized: boolean;
  isPeak: boolean;
}

export interface Module10CategoryEstimate {
  category: string;
  prepMinutes: number;
}
