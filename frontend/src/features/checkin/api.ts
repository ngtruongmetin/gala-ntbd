import { apiClient } from '../../lib/api-client';
import type { CheckInResponseData } from '../../types/checkin';

export async function scanQr(
  input: { requestId: string; qrToken: string; source: 'camera' | 'usb' },
  csrfToken: string,
): Promise<CheckInResponseData> {
  const response = await apiClient.post<{ data: CheckInResponseData }>('/check-in/scan', input, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}

export async function manualCheckIn(
  input: { requestId: string; ticketCode: string },
  csrfToken: string,
): Promise<CheckInResponseData> {
  const response = await apiClient.post<{ data: CheckInResponseData }>('/check-in/manual', input, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
  return response.data.data;
}

export async function undoCheckIn(ticketCode: string, reason: string, csrfToken: string) {
  const response = await apiClient.post<{ data: CheckInResponseData }>(
    `/check-in/tickets/${encodeURIComponent(ticketCode)}/undo`,
    { reason },
    { headers: { 'X-CSRF-Token': csrfToken } },
  );
  return response.data.data;
}
