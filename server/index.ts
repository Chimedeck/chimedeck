#!/usr/bin/env bun
import { appConfig } from './config/app';
import { flags } from './mods/flags';
import { logRequest } from './mods/logger';
import { applySecurityHeaders } from './mods/helmet';
import { parseJsonBody } from './middlewares/parser';
import { authRouter } from './extensions/auth/api/index';
import { usersRouter } from './extensions/users/api/index';
import { workspaceRouter } from './extensions/workspace/api/index';
import { boardRouter } from './extensions/board/api/index';
import { listRouter } from './extensions/list/api/index';
import { cardRouter } from './extensions/card/api/index';
import { labelRouter } from './extensions/label/api/index';
import { handleWsUpgrade, wsHandlers } from './extensions/realtime/api/index';
import { commentRouter } from './extensions/comment/api/index';
import { activityRouter } from './extensions/activity/api/index';
import { attachmentRouter } from './extensions/attachment/api/index';
import { searchRouter } from './extensions/search/api/index';
import { presenceRouter } from './extensions/presence/api/index';
import { startExpiryJob } from './extensions/presence/mods/expiryJob';
import { rooms } from './extensions/realtime/mods/rooms/index';
// Start orphan cleanup scheduler on server boot
import './extensions/attachment/mods/orphanCleanup';

// Load all feature flag sources before handling any requests
await flags.load();

// Start presence expiry background job — fires every 10 s
startExpiryJob(() => new Set(rooms.keys()));

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
    // Stub — allow-listed client flags will be populated in later sprints
    return Response.json({ data: {} });
  }

  const authResponse = await authRouter(req, path);
  if (authResponse) return authResponse;

  const usersResponse = await usersRouter(req, path);
  if (usersResponse) return usersResponse;

  const workspaceResponse = await workspaceRouter(req, path);
  if (workspaceResponse) return workspaceResponse;

  const boardResponse = await boardRouter(req, path);
  if (boardResponse) return boardResponse;

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
    { name: 'not-found', data: { message: `${req.method} ${path} not found` } },
    { status: 404 }
  );
}

Bun.serve({
  port: appConfig.port,

  async fetch(req, server) {
    // Try WebSocket upgrade first
    if (await handleWsUpgrade(req, server)) return;

    const start = Date.now();
    await parseJsonBody(req.clone() as unknown as Request);
    const res = await router(req);
    const headers = new Headers(res.headers);
    applySecurityHeaders(headers);
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
