import axios from 'axios';
import { shouldAttachAccessToken } from './requestPolicy';

// Token getter is set lazily from main.tsx after the store is created.
// This avoids a circular dependency between the API client and the Redux store.
let tokenGetter: (() => string | null) | null = null;

export const setTokenGetter = (fn: () => string | null) => {
  tokenGetter = fn;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
apiClient.interceptors.response.use((response) => response.data as any);

export default apiClient;
