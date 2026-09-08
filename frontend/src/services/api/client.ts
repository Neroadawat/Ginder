/**
 * Axios API client with auth token injection and refresh logic.
 */

import axios, {AxiosError, InternalAxiosRequestConfig} from 'axios';

import {API_BASE_URL} from '@/services/config';
import {useAuthStore} from '@/stores/authStore';

type ApiErrorBody = {
  detail?: string | Array<{loc?: Array<string | number>; msg?: string}>;
};

const formatApiError = (error: AxiosError): string => {
  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond. Please try again.';
  }

  if (!error.response) {
    return 'Cannot connect to the server. Check that the backend is running.';
  }

  const detail = (error.response.data as ApiErrorBody | undefined)?.detail;
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map(item => {
        const field = item.loc?.[item.loc.length - 1];
        const label =
          typeof field === 'string' ? field.replaceAll('_', ' ') : 'Input';
        return `${label}: ${item.msg ?? 'Invalid value'}`;
      })
      .join('\n');
  }

  return `Request failed (${error.response.status}). Please try again.`;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor: attach Bearer token ───
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// ─── Response interceptor: handle 401 with token refresh ───
apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const {access_token, refresh_token} = response.data;
        const payload = JSON.parse(atob(access_token.split('.')[1]));
        useAuthStore
          .getState()
          .setTokens(access_token, refresh_token, payload.sub);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    // Extract error message from response
    return Promise.reject(new Error(formatApiError(error)));
  },
);

export default apiClient;
