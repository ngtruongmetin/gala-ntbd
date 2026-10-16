import { apiClient } from '../../lib/api-client';
import type {
  AdminDashboard,
  AdminDashboardResponse,
  UpdateEventSettingsInput,
  EventPartnerInput,
} from '../../types/admin';
import type { EventSettingsResponse, EventSettings, EventPartner } from '../../types/event';
import type { Order, Ticket } from '../../types/order';
import type { Pagination, StaffGrant } from '../../types/admin';

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const response = await apiClient.get<AdminDashboardResponse>('/admin/dashboard');
  return response.data.data;
}

export async function listAdminOrders(params: {
  page?: number;
  status?: string;
  search?: string;
}): Promise<{ data: Order[]; pagination: Pagination }> {
  const response = await apiClient.get('/admin/orders', { params });
  return response.data;
}

export async function getAdminOrder(reference: string): Promise<Order> {
  const response = await apiClient.get<{ data: Order }>(
    `/admin/orders/${encodeURIComponent(reference)}`,
  );
  return response.data.data;
}

async function adminAction<T>(path: string, body: unknown, csrfToken: string): Promise<T> {
  const response = await apiClient.post<{ data: T }>(path, body, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}

export function recordManualPayment(
  reference: string,
  input: { transactionReference: string; amountVnd: number; occurredAt: string; notes?: string },
  csrfToken: string,
) {
  return adminAction(
    `/admin/orders/${encodeURIComponent(reference)}/payments/manual`,
    input,
    csrfToken,
  );
}

export function cancelAdminOrder(reference: string, reason: string, csrfToken: string) {
  return adminAction<Order>(
    `/admin/orders/${encodeURIComponent(reference)}/cancel`,
    { reason },
    csrfToken,
  );
}

export function requestOrderRefund(reference: string, reason: string, csrfToken: string) {
  return adminAction(
    `/admin/orders/${encodeURIComponent(reference)}/refund-request`,
    { reason },
    csrfToken,
  );
}

export function resolveOrderPayment(
  reference: string,
  input: { transactionId: string; decision: 'accept' | 'ignore'; reason: string },
  csrfToken: string,
) {
  return adminAction(
    `/admin/orders/${encodeURIComponent(reference)}/payment-review/resolve`,
    input,
    csrfToken,
  );
}

export function confirmManualRefund(
  reference: string,
  input: { transactionReference: string; amountVnd: number; occurredAt: string; notes?: string },
  csrfToken: string,
) {
  return adminAction(
    `/admin/orders/${encodeURIComponent(reference)}/refunds/manual`,
    input,
    csrfToken,
  );
}

export async function listAdminTickets(params: {
  page?: number;
  status?: string;
  search?: string;
}): Promise<{ data: Ticket[]; pagination: Pagination }> {
  const response = await apiClient.get('/admin/tickets', { params });
  return response.data;
}

export async function getAdminTicket(code: string): Promise<Ticket> {
  const response = await apiClient.get<{ data: Ticket }>(
    `/admin/tickets/${encodeURIComponent(code)}`,
  );
  return response.data.data;
}

export function voidAdminTicket(code: string, reason: string, csrfToken: string) {
  return adminAction<Ticket>(
    `/admin/tickets/${encodeURIComponent(code)}/void`,
    { reason },
    csrfToken,
  );
}

export function reactivateAdminTicket(code: string, reason: string, csrfToken: string) {
  return adminAction<Ticket>(
    `/admin/tickets/${encodeURIComponent(code)}/reactivate`,
    { reason },
    csrfToken,
  );
}

export function reissueAdminTicketQr(code: string, reason: string, csrfToken: string) {
  return adminAction<Ticket>(
    `/admin/tickets/${encodeURIComponent(code)}/reissue-qr`,
    { reason },
    csrfToken,
  );
}

export async function listStaff(): Promise<{
  bootstrapSuperAdmins: string[];
  grants: StaffGrant[];
}> {
  const response = await apiClient.get('/admin/staff');
  return response.data.data;
}

export async function createStaffGrant(
  input: { email: string; role: 'admin' | 'check_in' },
  csrfToken: string,
): Promise<StaffGrant> {
  const response = await apiClient.post<{ data: StaffGrant }>('/admin/staff', input, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}

export async function revokeStaffGrant(grantId: string, reason: string, csrfToken: string) {
  const response = await apiClient.delete(`/admin/staff/${grantId}`, {
    data: { reason },
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}

export async function updateEventSettings(
  input: UpdateEventSettingsInput,
  csrfToken: string,
): Promise<EventSettings> {
  const response = await apiClient.put<EventSettingsResponse>('/admin/event-settings', input, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}

export async function createEventPartner(input: EventPartnerInput, csrfToken: string) {
  const response = await apiClient.post<{ data: EventPartner }>(
    '/admin/partners',
    partnerForm(input),
    {
      headers: { 'X-CSRF-Token': csrfToken },
    },
  );
  return response.data.data;
}

export async function updateEventPartner(id: string, input: EventPartnerInput, csrfToken: string) {
  const response = await apiClient.put<{ data: EventPartner }>(
    `/admin/partners/${id}`,
    partnerForm(input),
    { headers: { 'X-CSRF-Token': csrfToken } },
  );
  return response.data.data;
}

function partnerForm(input: EventPartnerInput) {
  const form = new FormData();
  form.set('name', input.name);
  form.set('websiteUrl', input.websiteUrl ?? '');
  form.set('sortOrder', String(input.sortOrder));
  form.set('active', String(input.active));
  if (input.logo) form.set('logo', input.logo);
  return form;
}

export async function deleteEventPartner(id: string, csrfToken: string) {
  const response = await apiClient.delete<{ data: { id: string } }>(`/admin/partners/${id}`, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}
