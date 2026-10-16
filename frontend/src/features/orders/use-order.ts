import { useQuery } from '@tanstack/react-query';
import { getOrder, getPaymentInstructions } from './api';

export function useOrder(reference: string, enabled: boolean) {
  return useQuery({
    queryKey: ['orders', reference],
    queryFn: () => getOrder(reference),
    enabled,
    refetchInterval: (query) => (query.state.data?.status === 'pending_payment' ? 3_000 : false),
  });
}

export function usePaymentInstructions(reference: string, enabled: boolean) {
  return useQuery({
    queryKey: ['orders', reference, 'payment-instructions'],
    queryFn: () => getPaymentInstructions(reference),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
