// server/middlewares/rateLimiter.ts
// Redis sliding-window rate-limiting middleware.
// Gated by RATE_LIMIT_ENABLED. When disabled, every request passes through.
//
// Workspace-scoped READ/WRITE buckets are enabled only when subscriptions are on;
// auth/upload keep the legacy per-identifier limits so existing behaviour stays intact.
import Redis from 'ioredis';
import { env } from '../config/env';
import { FEATURE_KEYS } from '../extensions/subscription/common/featureKeys';
import { resolveEntitlements } from '../extensions/subscription/common/entitlements';
import { getCurrentTier } from '../extensions/subscription/common/subscriptionRepo';
import type { QuotaValue } from '../config/subscription-tiers';
import type { SubscriptionTier } from '../extensions/subscription/common/types';

type LegacyRouteClass = 'auth' | 'mutation' | 'read' | 'upload';
type WorkspaceRouteClass = 'read' | 'write';

const LEGACY_LIMITS: Record<LegacyRouteClass, number> = {
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

function classifyLegacyRoute(method: string, path: string): LegacyRouteClass {
  if (path.startsWith('/api/v1/auth/') || path.startsWith('/auth/')) return 'auth';
  if (path.includes('/attachments') && method === 'POST') return 'upload';
  if (method === 'GET' || method === 'HEAD') return 'read';
  return 'mutation';
}

function classifyWorkspaceClass(method: string): WorkspaceRouteClass {
  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}

function windowEpoch(): number {
  return Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
}

function getRequestIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiterClient {
  eval(script: string, numkeys: number, ...args: string[]): Promise<number>;
}

export interface RateLimitContext {
  workspaceId?: string | null;
  userId?: string;
}

const rateLimiterClient = env.REDIS_URL
  ? (new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    }) as unknown as RateLimiterClient)
  : null;

async function checkLimit(
  client: RateLimiterClient,
  key: string,
  limit: number
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

export function buildLegacyRateLimiterKey(
  routeClass: LegacyRouteClass,
  userId: string | undefined,
  ip: string
): string {
  const identifier = userId ?? ip;
  const epoch = windowEpoch();
  return `rl:${identifier}:${routeClass}:${epoch}`;
}

export function buildWorkspaceRateLimiterKey(
  workspaceId: string,
  routeClass: WorkspaceRouteClass
): string {
  const epoch = windowEpoch();
  return `rl:ws:${workspaceId}:${routeClass}:${epoch}`;
}

export async function workspaceLimitFor(
  workspaceId: string,
  routeClass: WorkspaceRouteClass
): Promise<{ tier: SubscriptionTier; limit: QuotaValue }> {
  const tier = await getCurrentTier(workspaceId);
  const entitlements = resolveEntitlements(tier);
  const limit =
    routeClass === 'read'
      ? entitlements[FEATURE_KEYS.rateLimit.readPerMinute]
      : entitlements[FEATURE_KEYS.rateLimit.writePerMinute];

  return { tier, limit };
}

function rateLimitResponse(args: {
  scope: 'legacy' | 'workspace';
  routeClass: LegacyRouteClass | WorkspaceRouteClass;
  limit: number;
  retryAfterSeconds: number;
  currentTier?: SubscriptionTier;
}): Response {
  return Response.json(
    {
      error: {
        code: 'rate-limit-exceeded',
        message: 'Too many requests, please slow down.',
        data: {
          scope: args.scope,
          class: args.routeClass,
          limit: args.limit,
          retryAfterSeconds: args.retryAfterSeconds,
          currentTier: args.currentTier,
        },
      },
    },
    {
      status: 429,
      headers: { 'Retry-After': String(args.retryAfterSeconds) },
    }
  );
}

export async function applyRateLimit(
  req: Request,
  context: RateLimitContext = {},
  client: RateLimiterClient | null = rateLimiterClient
): Promise<Response | null> {
  if (!env.RATE_LIMIT_ENABLED || !client) return null;

  const url = new URL(req.url);
  const ip = getRequestIp(req);
  const legacyClass = classifyLegacyRoute(req.method, url.pathname);
  const identifier = context.userId ?? ip;

  try {
    if (
      env.SUBSCRIPTIONS_ENABLED &&
      context.workspaceId &&
      legacyClass !== 'auth' &&
      legacyClass !== 'upload'
    ) {
      const workspaceClass = classifyWorkspaceClass(req.method);
      const { tier, limit } = await workspaceLimitFor(context.workspaceId, workspaceClass);

      if (limit === 'unlimited') return null;

      const key = buildWorkspaceRateLimiterKey(context.workspaceId, workspaceClass);
      const result = await checkLimit(client, key, limit);
      if (!result.allowed) {
        return rateLimitResponse({
          scope: 'workspace',
          routeClass: workspaceClass,
          limit,
          retryAfterSeconds: result.retryAfterSeconds,
          currentTier: tier,
        });
      }

      return null;
    }

    const limit = LEGACY_LIMITS[legacyClass];
    const key = buildLegacyRateLimiterKey(legacyClass, identifier, ip);
    const result = await checkLimit(client, key, limit);
    if (!result.allowed) {
      return rateLimitResponse({
        scope: 'legacy',
        routeClass: legacyClass,
        limit,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
  } catch (err) {
    // Redis unavailable — degrade gracefully: log and allow traffic through.
    console.warn('[rate-limiter] Redis error, bypassing limit:', err);
  }

  return null;
}

export { classifyLegacyRoute, classifyWorkspaceClass, rateLimiterClient };
