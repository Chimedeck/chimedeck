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

// Load all feature flag sources before handling any requests
await flags.load();

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

  return Response.json(
    { name: 'not-found', data: { message: `${req.method} ${path} not found` } },
    { status: 404 }
  );
}

Bun.serve({
  port: appConfig.port,

  async fetch(req) {
    const start = Date.now();

    // Parse body (side-effect free; body is consumed separately per route handler)
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
});

console.info(`[server] Listening on http://localhost:${appConfig.port}`);
