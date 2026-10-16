import axios from 'axios';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

export function getGoogleLoginUrl(returnTo = '/dat-ve') {
  return `${apiBaseUrl.replace(/\/$/, '')}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}
