import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, logout } from './api';

export const authQueryKey = ['auth', 'me'] as const;

export function useAuth() {
  return useQuery({ queryKey: authQueryKey, queryFn: getCurrentUser, staleTime: 30_000 });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authQueryKey }),
  });
}
