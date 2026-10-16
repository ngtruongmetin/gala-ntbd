import { apiClient } from '../../lib/api-client';
import type { AuthResponse, AuthState } from '../../types/auth';

export async function getCurrentUser(): Promise<AuthState> {
  const response = await apiClient.get<AuthResponse>('/auth/me');
  return response.data.data;
}

export async function logout(csrfToken: string): Promise<void> {
  await apiClient.post('/auth/logout', undefined, {
    headers: { 'X-CSRF-Token': csrfToken },
  });
}
