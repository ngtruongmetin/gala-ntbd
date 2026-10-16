import { apiClient } from '../../lib/api-client';
import type { Order, Ticket } from '../../types/order';

export async function listAccountOrders(): Promise<Order[]> {
  const response = await apiClient.get<{ data: Order[] }>('/account/orders');
  return response.data.data;
}

export async function getAccountOrder(reference: string): Promise<Order> {
  const response = await apiClient.get<{ data: Order }>(
    `/account/orders/${encodeURIComponent(reference)}`,
  );
  return response.data.data;
}

export async function cancelAccountOrder(
  reference: string,
  reason: string,
  csrfToken: string,
): Promise<Order> {
  const response = await apiClient.post<{ data: Order }>(
    `/account/orders/${encodeURIComponent(reference)}/cancel`,
    { reason },
    { headers: { 'X-CSRF-Token': csrfToken } },
  );
  return response.data.data;
}

export async function listAccountTickets(): Promise<Ticket[]> {
  const response = await apiClient.get<{ data: Ticket[] }>('/account/tickets');
  return response.data.data;
}

export async function getAccountTicket(code: string): Promise<Ticket> {
  const response = await apiClient.get<{ data: Ticket }>(
    `/account/tickets/${encodeURIComponent(code)}`,
  );
  return response.data.data;
}
