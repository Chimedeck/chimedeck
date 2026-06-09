import axios, { type InternalAxiosRequestConfig } from 'axios';
import { shouldAttachAccessToken, shouldAttemptAuthRecovery } from './requestPolicy';

// Token getter is set lazily from main.tsx after the store is created.
// This avoids a circular dependency between the API client and the Redux store.
let tokenGetter: (() => string | null) | null = null;
let clearAuthCallback: (() => void) | null = null;
let refreshRequestPromise: Promise<unknown> | null = null;
let didHandleSessionExpiry = false;
let lastSubscriptionRedirectAt = 0;

export const setTokenGetter = (fn: () => string | null) => {
  tokenGetter = fn;
};

// clearAuth callback is set lazily from main.tsx to avoid circular deps with store.
export const setClearAuthCallback = (fn: () => void) => {
  clearAuthCallback = fn;
};

// Single axios instance used by all extension API modules.
// baseURL uses the Vite proxy so /api/v1 routes resolve to the Bun server.
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token from Redux on every request.
// [why] If a caller already sets Authorization (e.g. plugin JWT for plugin-data endpoints)
// we must not overwrite it — their explicitly-passed token takes precedence.
// Public endpoints must also stay header-free so stale client auth state does not
// make them behave like protected routes.
apiClient.interceptors.request.use((config) => {
  const token = tokenGetter?.() ?? null;
  if (token && !config.headers.Authorization && shouldAttachAccessToken({ url: config.url, method: config.method })) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-unwrap axios response so callers receive the HTTP response body directly.
// This matches the declared API function signatures: Promise<T> not Promise<AxiosResponse<T>>.
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
apiClient.interceptors.response.use((response) => response.data);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosErrorLike(error)) {
      throw toError(error);
    }

    const subscriptionError = extractSubscriptionError(error.response?.data);
    if (subscriptionError) {
      const now = Date.now();
      if (now - lastSubscriptionRedirectAt < 2000) {
        throw toError(error);
      }

      const currentPath = globalThis.location.pathname;
      const billingTarget = subscriptionError.upgradeUrl;
      const alreadyOnBilling = billingTarget ? currentPath.startsWith(billingTarget) : false;

      if (!alreadyOnBilling) {
        lastSubscriptionRedirectAt = now;
        globalThis.alert(subscriptionError.message);
        globalThis.location.assign(subscriptionError.upgradeUrl);
      }
      throw toError(error);
    }

    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const shouldRecover = isExpiredAccessTokenError(error);

    if (
      !shouldRecover
      || !originalRequest
      || originalRequest._retry
      || !shouldAttemptAuthRecovery({ url: originalRequest.url, method: originalRequest.method })
    ) {
      throw toError(error);
    }

    originalRequest._retry = true;

    try {
      refreshRequestPromise ??= apiClient
        .post('/auth/refresh')
        .finally(clearRefreshRequestPromise);

      await refreshRequestPromise;
      return await apiClient(originalRequest);
    } catch {
      if (!didHandleSessionExpiry) {
        didHandleSessionExpiry = true;
        clearAuthCallback?.();
        globalThis.location.href = '/login?reason=session_expired';
      }

      throw toError(error);
    }
  },
);

function isAxiosErrorLike(
  err: unknown
): err is { response?: { status?: number; data?: unknown }; config?: unknown } {
  return typeof err === 'object' && err !== null && 'config' in err;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function clearRefreshRequestPromise() {
  refreshRequestPromise = null;
}

function isExpiredAccessTokenError(err: {
  response?: { data?: unknown };
}): boolean {
  const message = getApiErrorMessage(err.response?.data);
  return message === 'Invalid or expired access token';
}

function getApiErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const maybeError = (data as { error?: unknown }).error;
  if (!maybeError || typeof maybeError !== 'object') return null;
  const message = (maybeError as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

function extractSubscriptionError(data: unknown): { message: string; upgradeUrl: string } | null {
  if (!data || typeof data !== 'object') return null;
  const maybeError = (data as { error?: unknown }).error;
  if (!maybeError || typeof maybeError !== 'object') return null;

  const code = (maybeError as { code?: unknown }).code;
  if (code !== 'subscription-payment-required') return null;

  const message = (maybeError as { message?: unknown }).message;
  const maybeData = (maybeError as { data?: unknown }).data;
  const upgradeUrl = typeof maybeData === 'object' && maybeData !== null
    ? (maybeData as { upgradeUrl?: unknown }).upgradeUrl
    : null;

  if (typeof message !== 'string' || typeof upgradeUrl !== 'string' || upgradeUrl.length === 0) {
    return null;
  }

  return { message, upgradeUrl };
}

export default apiClient;
