import { useQuery } from '@tanstack/react-query';
import { getEventSettings } from './api';

export function useEventSettings() {
  return useQuery({
    queryKey: ['event-settings'],
    queryFn: getEventSettings,
    staleTime: 30_000,
    retry: 1,
  });
}
