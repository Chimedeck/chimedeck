// server/middlewares/rateLimiter.ts
// Redis sliding-window rate-limiting middleware.
// Gated by RATE_LIMIT_ENABLED. When disabled, every request passes through.
//
// Lua script ensures INCR + EXPIRE are atomic within a single 60-second window.
// Key format: rl:<userId|ip>:<routeClass>:<windowEpoch>
import { env } from '../config/env';

type RouteClass = 'auth' | 'mutation' | 'read' | 'upload';

// Requests-per-minute limits per route class.
const LIMITS: Record<RouteClass, number> = {
  auth: 10,
  mutation: 120,
  read: 600,
  upload: 20,
};

const WINDOW_SECONDS = 60;

// Lua script: atomically INCR and set TTL on first access.
const LUA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`.trim();

function classifyRoute(method: string, path: string): RouteClass {
  if (path.startsWith('/api/v1/auth/') || path.startsWith('/auth/')) return 'auth';
  if (path.includes('/attachments') && method === 'POST') return 'upload';
  if (method === 'GET' || method === 'HEAD') return 'read';
  return 'mutation';
}

function windowEpoch(): number {
  return Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiterClient {
  eval(script: string, numkeys: number, key: string, ttl: string): Promise<number>;
}

async function checkLimit(
  client: RateLimiterClient,
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  const count = await client.eval(LUA_SCRIPT, 1, key, String(WINDOW_SECONDS));
  if (count > limit) {
    const epoch = windowEpoch();
    const windowEnd = (epoch + 1) * WINDOW_SECONDS;
    const retryAfterSeconds = windowEnd - Math.floor(Date.now() / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function buildRateLimiterKey(
  routeClass: RouteClass,
  userId: string | undefined,
  ip: string,
): string {
  const identifier = userId ?? ip;
  const epoch = windowEpoch();
  return `rl:${identifier}:${routeClass}:${epoch}`;
}

export async function applyRateLimit(
  req: Request,
  userId: string | undefined,
  client: RateLimiterClient | null,
): Promise<Response | null> {
  if (!env.RATE_LIMIT_ENABLED || !client) return null;

  const url = new URL(req.url);
  const routeClass = classifyRoute(req.method, url.pathname);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const key = buildRateLimiterKey(routeClass, userId, ip);
  const limit = LIMITS[routeClass];

  try {
    const result = await checkLimit(client, key, limit);
    if (!result.allowed) {
      return Response.json(
        { error: { code: 'rate-limit-exceeded', message: 'Too many requests, please slow down.' } },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfterSeconds) },
        },
      );
    }
  } catch (err) {
    // Redis unavailable — degrade gracefully: log and allow traffic through.
    console.warn('[rate-limiter] Redis error, bypassing limit:', err);
  }

  return null;
}
