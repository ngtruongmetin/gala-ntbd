import axios from 'axios';

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}
