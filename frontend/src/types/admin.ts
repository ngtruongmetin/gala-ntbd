import type { EventPartner, EventSettings } from './event';

export interface AdminSummary {
  pendingOrders: number;
  paidOrders: number;
  reviewOrders: number;
  refundPendingOrders: number;
  expiredOrders: number;
  reservedTickets: number;
  soldTickets: number;
  validTickets: number;
  checkedInTickets: number;
  voidTickets: number;
  refundedTickets: number;
  grossRevenueVnd: number;
  refundedRevenueVnd: number;
  netRevenueVnd: number;
}

export interface AdminDashboard {
  settings: EventSettings;
  summary: AdminSummary;
  configuredAdminEmails: string[];
  activeAdminEmails: string[];
  trend: Array<{ day: string; orders: number; revenueVnd: number }>;
  reviewOrders: Array<{
    reference: string;
    buyerName: string;
    totalAmountVnd: number;
    updatedAt: string;
  }>;
  recentCheckIns: Array<{
    result: string;
    occurredAt: string;
    ticketCode: string | null;
    operatorEmail: string;
  }>;
  partners: EventPartner[];
}

export interface EventPartnerInput {
  name: string;
  websiteUrl: string | null;
  sortOrder: number;
  active: boolean;
  logo?: File;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface StaffGrant {
  id: string;
  email: string;
  role: 'admin' | 'check_in';
  active: boolean;
  displayName: string | null;
  createdAt: string;
}

export interface AdminDashboardResponse {
  data: AdminDashboard;
}

export interface UpdateEventSettingsInput {
  eventName: string;
  eventSubtitle: string;
  venue: string;
  eventStartsAt: string;
  ticketPriceVnd: number;
  totalCapacity: number;
  minTicketsPerOrder: number;
  maxTicketsPerOrder: number;
  salesStartAt: string;
  salesEndAt: string;
  reservationMinutes: number;
  salesStatus: 'open' | 'paused';
}
