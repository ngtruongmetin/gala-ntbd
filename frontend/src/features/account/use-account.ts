import { useQuery } from '@tanstack/react-query';
import { getAccountOrder, getAccountTicket, listAccountOrders, listAccountTickets } from './api';

export function useAccountOrders(enabled = true) {
  return useQuery({ queryKey: ['account', 'orders'], queryFn: listAccountOrders, enabled });
}

export function useAccountOrder(reference: string, enabled = true) {
  return useQuery({
    queryKey: ['account', 'orders', reference],
    queryFn: () => getAccountOrder(reference),
    enabled,
  });
}

export function useAccountTickets(enabled = true) {
  return useQuery({ queryKey: ['account', 'tickets'], queryFn: listAccountTickets, enabled });
}

export function useAccountTicket(code: string, enabled = true) {
  return useQuery({
    queryKey: ['account', 'tickets', code],
    queryFn: () => getAccountTicket(code),
    enabled,
  });
}
