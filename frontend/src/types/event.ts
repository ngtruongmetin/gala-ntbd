export type SalesStatus = 'open' | 'paused';
export type AvailabilityStatus = 'open' | 'paused' | 'not_started' | 'ended' | 'sold_out';

export interface EventSettings {
  eventName: string;
  eventSubtitle: string | null;
  venue: string | null;
  eventStartsAt: string | null;
  ticketPriceVnd: number;
  totalCapacity: number;
  minTicketsPerOrder: number;
  maxTicketsPerOrder: number;
  salesStartAt: string;
  salesEndAt: string;
  reservationMinutes: number;
  salesStatus: SalesStatus;
  remainingQuantity: number;
  availabilityStatus: AvailabilityStatus;
  canOrder: boolean;
  serverTime: string;
  partners: EventPartner[];
}

export interface EventPartner {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl: string | null;
  sortOrder: number;
  active: boolean;
}

export interface EventSettingsResponse {
  data: EventSettings;
}
