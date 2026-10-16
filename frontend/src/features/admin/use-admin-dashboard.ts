import { useQuery } from '@tanstack/react-query';
import { getAdminDashboard } from './api';

export const adminDashboardQueryKey = ['admin', 'dashboard'] as const;

export function useAdminDashboard(enabled: boolean) {
  return useQuery({
    queryKey: adminDashboardQueryKey,
    queryFn: getAdminDashboard,
    enabled,
  });
}
