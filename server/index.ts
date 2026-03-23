#!/usr/bin/env bun
import { appConfig } from './config/app';
import { flags } from './mods/flags';
import { logRequest } from './mods/logger';
import { applySecurityHeaders } from './mods/helmet';
import { getPluginCspOrigins, type PluginCspOrigins } from './extensions/plugins/mods/getPluginCspOrigins';
import { parseJsonBody } from './middlewares/parser';
import { csrfGuard } from './middlewares/csrfGuard';
import { authRouter } from './extensions/auth/api/index';
import { usersRouter } from './extensions/users/api/index';
import { workspaceRouter } from './extensions/workspace/api/index';
import { boardRouter } from './extensions/board/api/index';
import { listRouter } from './extensions/list/api/index';
import { cardRouter } from './extensions/card/api/index';
import { labelRouter } from './extensions/label/api/index';
import { handleWsUpgrade, wsHandlers } from './extensions/realtime/api/index';
import { handlePropagationPing } from './extensions/realtime/api/metrics';
import { commentRouter } from './extensions/comment/api/index';
import { activityRouter } from './extensions/activity/api/index';
import { attachmentRouter } from './extensions/attachment/api/index';
import { searchRouter } from './extensions/search/api/index';
import { presenceRouter } from './extensions/presence/api/index';
import { notificationsRouter } from './extensions/notifications/api/index';
import { startExpiryJob } from './extensions/presence/mods/expiryJob';
import { rooms } from './extensions/realtime/mods/rooms/index';
// Start orphan cleanup scheduler on server boot
import './extensions/attachment/mods/orphanCleanup';
import { ensureBucketExists } from './extensions/attachment/common/config/s3';
import { pluginsRouter } from './extensions/plugins/api/index';
import { pluginsConfig } from './extensions/plugins/config/index';
import { env } from './config/env';
import { boardViewRouter } from './extensions/boardView/api/index';
import { customFieldsRouter } from './extensions/customFields/index';
import { automationRouter } from './extensions/automation/api/index';
import { offlineDraftsRouter } from './extensions/offlineDrafts/api/index';
import { apiTokenRouter } from './extensions/apiToken/api/index';
// Register all automation trigger handlers at startup.
import './extensions/automation/engine/triggers/index';
import { startAutomationScheduler } from './extensions/automation/scheduler/index';
import { initObservability } from './mods/observability/index';

// Initialise OTel tracing + metrics (no-op when OTEL_ENABLED=false)
await initObservability();

// Load all feature flag sources before handling any requests
await flags.load();

// Ensure the S3 bucket exists (auto-creates when using LocalStack / custom endpoint)
await ensureBucketExists();

// Start presence expiry background job — fires every 10 s
startExpiryJob(() => new Set(rooms.keys()));

// Start automation scheduler (pg LISTEN or Bun Worker fallback depending on config)
await startAutomationScheduler();

// Serve a static file from the dist/ folder (production SPA assets)
async function serveStatic(filePath: string): Promise<Response | null> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  return new Response(file);
}

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === '/health' && req.method === 'GET') {
    return Response.json({ status: 'ok' });
  }

  if (path === '/api/v1/flags' && req.method === 'GET') {
    const sesEnabled = await flags.isEnabled('SES_ENABLED');
    const notificationPreferencesEnabled = await flags.isEnabled('NOTIFICATION_PREFERENCES_ENABLED');
    const emailNotificationsEnabled = await flags.isEnabled('EMAIL_NOTIFICATIONS_ENABLED');
    const emailVerificationEnabled = await flags.isEnabled('EMAIL_VERIFICATION_ENABLED');
    return Response.json({
      data: {
        sesEnabled,
        adminInviteEmailEnabled: env.ADMIN_INVITE_EMAIL_ENABLED,
        adminEmailDomains: env.ADMIN_EMAIL_DOMAINS,
        notificationPreferencesEnabled,
        emailNotificationsEnabled,
        emailVerificationEnabled,
      },
    });
  }

  if (path === '/api/v1/metrics/propagation') {
    return handlePropagationPing(req);
  }

  const authResponse = await authRouter(req, path);
  if (authResponse) return authResponse;

  const usersResponse = await usersRouter(req, path);
  if (usersResponse) return usersResponse;

  const workspaceResponse = await workspaceRouter(req, path);
  if (workspaceResponse) return workspaceResponse;

  const boardResponse = await boardRouter(req, path);
  if (boardResponse) return boardResponse;

  const boardViewResponse = await boardViewRouter(req, path);
  if (boardViewResponse) return boardViewResponse;

  const customFieldsResponse = await customFieldsRouter(req, path);
  if (customFieldsResponse) return customFieldsResponse;

  const listResponse = await listRouter(req, path);
  if (listResponse) return listResponse;

  const cardResponse = await cardRouter(req, path);
  if (cardResponse) return cardResponse;

  const labelResponse = await labelRouter(req, path);
  if (labelResponse) return labelResponse;

  const commentResponse = await commentRouter(req, path);
  if (commentResponse) return commentResponse;

  const activityResponse = await activityRouter(req, path);
  if (activityResponse) return activityResponse;

  const attachmentResponse = await attachmentRouter(req, path);
  if (attachmentResponse) return attachmentResponse;

  const searchResponse = await searchRouter(req, path);
  if (searchResponse) return searchResponse;

  const presenceResponse = await presenceRouter(req, path);
  if (presenceResponse) return presenceResponse;

  const notificationsResponse = await notificationsRouter(req, path);
  if (notificationsResponse) return notificationsResponse;

  const pluginsResponse = await pluginsRouter(req, path);
  if (pluginsResponse) return pluginsResponse;

  const automationResponse = await automationRouter(req, path);
  if (automationResponse) return automationResponse;

  const offlineDraftsResponse = await offlineDraftsRouter(req, path);
  if (offlineDraftsResponse) return offlineDraftsResponse;

  const apiTokenResponse = await apiTokenRouter(req, path);
  if (apiTokenResponse) return apiTokenResponse;

  // Serve the SDK static bundle at /sdk/jh-instance.js
  if (path === pluginsConfig.sdkServePath && req.method === 'GET') {
    const sdkFile = Bun.file(pluginsConfig.sdkBundlePath);
    if (await sdkFile.exists()) {
      return new Response(sdkFile, {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }
  }

  // In production serve the built React SPA so client-side routing works.
  // Try the exact asset path first (JS/CSS chunks), then fall back to index.html.
  if (appConfig.isDev === false) {
    const distRoot = `${import.meta.dir}/../dist`;
    const assetFile = await serveStatic(`${distRoot}${path}`);
    if (assetFile) return assetFile;
    const indexFile = await serveStatic(`${distRoot}/index.html`);
    if (indexFile) return indexFile;
  }

  return Response.json(
    { error: { code: 'not-found', message: `${req.method} ${path} not found` } },
    { status: 404 }
  );
}

// ── Plugin CSP origin cache ────────────────────────────────────────────────
// [why] Plugin connector_url and whitelisted_domains must appear in the CSP
// frame-src / connect-src directives so the browser permits loading plugin
// iframes and their outbound API calls. We cache for 60 s to avoid a DB hit
// on every request while still reflecting new plugin registrations promptly.
let _pluginOriginCache: PluginCspOrigins = { frameSrc: [], connectSrc: [] };
let _pluginOriginCacheExpiry = 0;
const PLUGIN_ORIGIN_TTL_MS = 60_000;

async function getCachedPluginOrigins(): Promise<PluginCspOrigins> {
  const now = Date.now();
  if (now < _pluginOriginCacheExpiry) return _pluginOriginCache;
  try {
    _pluginOriginCache = await getPluginCspOrigins();
    _pluginOriginCacheExpiry = now + PLUGIN_ORIGIN_TTL_MS;
  } catch {
    // On DB error keep using the stale cache rather than crashing.
  }
  return _pluginOriginCache;
}

Bun.serve({
  port: appConfig.port,

  async fetch(req, server) {
    // Try WebSocket upgrade first
    if (await handleWsUpgrade(req, server)) return;

    const start = Date.now();
    await parseJsonBody(req.clone() as unknown as Request);

    // CSRF origin guard — reject mutating requests from foreign origins.
    const csrfError = csrfGuard(req);
    if (csrfError) {
      logRequest(req, 403, Date.now() - start);
      return csrfError;
    }

    const res = await router(req);
    const headers = new Headers(res.headers);
    const pluginOrigins = await getCachedPluginOrigins();

    // S3 origin for avatar/attachment images — LocalStack uses S3_ENDPOINT directly,
    // production uses the virtual-hosted bucket URL.
    const s3ImgOrigin = env.S3_ENDPOINT
      ? env.S3_ENDPOINT
      : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`;

    applySecurityHeaders(headers, {
      extraFrameSrc: pluginOrigins.frameSrc,
      extraConnectSrc: [s3ImgOrigin, ...pluginOrigins.connectSrc],
      extraImgSrc: [s3ImgOrigin, 'https://horiflow.jhorizon.io'],
    });
    const response = new Response(res.body, {
      status: res.status,
      headers,
    });
    logRequest(req, response.status, Date.now() - start);
    return response;
  },

  websocket: wsHandlers,
});

console.info(`[server] Listening on http://localhost:${appConfig.port}`);
