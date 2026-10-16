import { apiClient } from '../../lib/api-client';
import type {
  CreateOrderInput,
  Order,
  OrderResponse,
  PaymentInstructions,
} from '../../types/order';

export async function createOrder(input: CreateOrderInput, csrfToken: string): Promise<Order> {
  const response = await apiClient.post<OrderResponse>('/orders', input, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}

export async function getOrder(reference: string): Promise<Order> {
  const response = await apiClient.get<OrderResponse>(`/orders/${encodeURIComponent(reference)}`);
  return response.data.data;
}

export async function getPaymentInstructions(reference: string): Promise<PaymentInstructions> {
  const response = await apiClient.get<{ data: PaymentInstructions }>(
    `/orders/${encodeURIComponent(reference)}/payment-instructions`,
  );
  return response.data.data;
}
