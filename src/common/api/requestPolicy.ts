const API_PREFIX = '/api/v1';

const PUBLIC_API_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  { method: 'GET', pattern: /^\/flags$/ },
  { method: 'POST', pattern: /^\/auth\/token$/ },
  { method: 'POST', pattern: /^\/auth\/register$/ },
  { method: 'POST', pattern: /^\/auth\/refresh$/ },
  { method: 'GET', pattern: /^\/auth\/verify-email$/ },
  { method: 'GET', pattern: /^\/auth\/confirm-email-change$/ },
  { method: 'POST', pattern: /^\/auth\/forgot-password$/ },
  { method: 'POST', pattern: /^\/auth\/reset-password$/ },
  { method: 'GET', pattern: /^\/invites\/[^/]+$/ },
];

function normalizeApiPath(url?: string): string | null {
  if (!url) return null;

  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    if (pathname.startsWith(API_PREFIX)) {
      return pathname.slice(API_PREFIX.length) || '/';
    }
    return pathname;
  } catch {
    return null;
  }
}

export function isPublicApiRoute({
  url,
  method,
}: {
  url?: string;
  method?: string;
}): boolean {
  const pathname = normalizeApiPath(url);
  if (!pathname) return false;

  const normalizedMethod = (method ?? 'GET').toUpperCase();
  return PUBLIC_API_ROUTES.some(
    (route) => route.method === normalizedMethod && route.pattern.test(pathname),
  );
}

export function isRefreshApiRoute({
  url,
  method,
}: {
  url?: string;
  method?: string;
}): boolean {
  const pathname = normalizeApiPath(url);
  return pathname === '/auth/refresh' && (method ?? 'GET').toUpperCase() === 'POST';
}

export function shouldAttachAccessToken({
  url,
  method,
}: {
  url?: string;
  method?: string;
}): boolean {
  return !isPublicApiRoute({ url, method });
}

export function shouldAttemptAuthRecovery({
  url,
  method,
}: {
  url?: string;
  method?: string;
}): boolean {
  return !isPublicApiRoute({ url, method }) && !isRefreshApiRoute({ url, method });
}