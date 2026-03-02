import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './client';

// clearAuth callback set from main.tsx to avoid circular dep with store
let clearAuthCallback: (() => void) | null = null;

export const setClearAuthCallback = (fn: () => void) => {
  clearAuthCallback = fn;
};

let isRefreshing = false;

// 401 response interceptor: attempt token refresh once; logout on failure
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    if (!isAxiosErrorLike(error)) return Promise.reject(error);

    const status = error.response?.status;
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (status === 401 && !originalRequest._retry && !isRefreshing) {
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await apiClient.post('/auth/refresh');
        isRefreshing = false;
        return apiClient(originalRequest);
      } catch {
        isRefreshing = false;
        clearAuthCallback?.();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

function isAxiosErrorLike(
  err: unknown
): err is { response?: { status?: number }; config: unknown } {
  return typeof err === 'object' && err !== null && 'config' in err;
}

