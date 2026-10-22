/**
 * Axios API client with auth token injection and refresh logic.
 */

import axios, {AxiosError, InternalAxiosRequestConfig} from 'axios';
import {jwtDecode} from 'jwt-decode';

import {API_BASE_URL} from '@/services/config';
import {getAuthRevision, useAuthStore} from '@/stores/authStore';

// A first search in a new area may query a public OSM mirror. Later searches
// use the server's seven-day cache and stay within the normal 15-second limit.
export const DISCOVERY_TIMEOUT_MS = 45000;

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

type AuthRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _authRevision?: number;
};
const authenticationChanged = () =>
  new Error('Authentication changed. Please try again.');

// ─── Request interceptor: attach Bearer token ───
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const request = config as AuthRequestConfig;
    if (
      request._authRevision !== undefined &&
      request._authRevision !== getAuthRevision()
    ) {
      return Promise.reject(authenticationChanged());
    }
    request._authRevision = getAuthRevision();
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
  response => {
    if (
      (response.config as AuthRequestConfig)._authRevision !== getAuthRevision()
    ) {
      return Promise.reject(authenticationChanged());
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AuthRequestConfig | undefined;
    // Never retry an old account's operation (especially DELETE) using the
    // next account's refresh token or deliver its private data to new screens.
    if (
      originalRequest &&
      originalRequest._authRevision !== getAuthRevision()
    ) {
      return Promise.reject(authenticationChanged());
    }

    const authRequest = originalRequest?.url?.startsWith('/auth/');
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !authRequest
    ) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      const userId = useAuthStore.getState().userId;
      if (!refreshToken) {
        await useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {
            refresh_token: refreshToken,
          },
          {timeout: 15000},
        );

        // A slow refresh must never restore a logged-out or different account.
        if (
          useAuthStore.getState().refreshToken !== refreshToken ||
          useAuthStore.getState().userId !== userId
        ) {
          return Promise.reject(
            new Error('Authentication changed. Please try again.'),
          );
        }

        const {access_token, refresh_token} = response.data;
        const payload = jwtDecode<{sub: string}>(access_token);
        await useAuthStore
          .getState()
          .setTokens(access_token, refresh_token, payload.sub, refreshToken);

        if (
          useAuthStore.getState().userId !== userId ||
          useAuthStore.getState().accessToken !== access_token
        ) {
          return Promise.reject(
            new Error('Authentication changed. Please try again.'),
          );
        }

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return apiClient(originalRequest);
      } catch {
        if (
          useAuthStore.getState().refreshToken === refreshToken &&
          useAuthStore.getState().userId === userId
        ) {
          await useAuthStore.getState().logout();
        }
        return Promise.reject(error);
      }
    }

    // Extract error message from response
    return Promise.reject(new Error(formatApiError(error)));
  },
);

export default apiClient;
