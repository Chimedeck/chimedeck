#!/usr/bin/env bun
import { appConfig } from './config/app';
import { flags } from './mods/flags';
import { logRequest } from './mods/logger';
import { applySecurityHeaders } from './mods/helmet';
import { parseJsonBody } from './middlewares/parser';

// Load all feature flag sources before handling any requests
await flags.load();

function router(req: Request): Response {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === '/health' && req.method === 'GET') {
    return Response.json({ status: 'ok' });
  }

  if (path === '/api/v1/flags' && req.method === 'GET') {
    // Stub — allow-listed client flags will be populated in later sprints
    return Response.json({ data: {} });
  }

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

    const res = router(req);
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
