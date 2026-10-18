export interface Module10OrderTimestampEvent {
  orderId: number;
  occurredAt: Date;
  source: 'Module 6';
}

export interface Module10HourlyVolume {
  hourStart: Date;
  orderCount: number;
  finalized: boolean;
  isPeak: boolean;
}

export interface Module10CategoryEstimate {
  category: string;
  minMinutes: number;
  maxMinutes: number;
  prepMinutes: number; // = maxMinutes, para sa lumang HTML
}