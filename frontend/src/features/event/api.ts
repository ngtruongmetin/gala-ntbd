import { apiClient } from '../../lib/api-client';
import type { EventSettings, EventSettingsResponse } from '../../types/event';

export async function getEventSettings(): Promise<EventSettings> {
  const response = await apiClient.get<EventSettingsResponse>('/event-settings');
  return response.data.data;
}
