import { expect, mock } from 'bun:test';

const calls: unknown[][] = [];
let authError: Response | undefined;
let visibilityError: Response | undefined;
let row: { id: string; url: string; expected_status: number | null } | undefined;
let dbError: Error | undefined;
let probeError: Error | undefined = undefined;
let allowed = true;
const result = {
  id: 'result', healthCheckId: 'check', status: 'healthy', httpStatus: 401,
  responseTimeMs: 12, errorMessage: null, checkedAt: '2026-01-01T00:00:00.000Z',
};
await mock.module('../../../../common/db', () => ({
  db: (table: string) => {
    calls.push(['db', table]);
    return {
      where: (conditions: unknown) => {
        calls.push(['where', conditions]);
        return { first: () => dbError ? Promise.reject(dbError) : Promise.resolve(row) };
      },
    };
  },
}));
await mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: (req: Request) => {
    calls.push(['auth', req.url]);
    return Promise.resolve(authError);
  },
}));
await mock.module('../../../../middlewares/boardVisibility', () => ({
  applyBoardVisibility: (_req: Request, boardId: string) => {
    calls.push(['visibility', boardId]);
    return Promise.resolve(visibilityError);
  },
}));
await mock.module('../../mods/rateLimiter', () => ({
  checkRateLimit: (key: string) => { calls.push(['limit', key]); return allowed; },
  retryAfterMs: (key: string) => { calls.push(['retry', key]); return 1501; },
}));
await mock.module('../../mods/probe', () => ({
  probe: (input: unknown) => {
    calls.push(['probe', input]);
    return probeError ? Promise.reject(probeError) : Promise.resolve(result);
  },
}));
const { handleProbeHealthCheck } = await import('../probe');
const request = new Request('http://127.0.0.1/health');
const invoke = () => handleProbeHealthCheck(request, 'board', 'check');
const prefix = [['auth', request.url], ['visibility', 'board']];
const query = [['db', 'board_health_checks'], ['where', { id: 'check', board_id: 'board', is_active: true }]];

authError = new Response('unauthorized', { status: 401 });
expect(await invoke()).toBe(authError);
expect(calls.splice(0)).toEqual([['auth', request.url]]);
authError = undefined;
visibilityError = new Response('forbidden', { status: 403 });
expect(await invoke()).toBe(visibilityError);
expect(calls.splice(0)).toEqual(prefix);
visibilityError = undefined;
const missing = await invoke();
expect(missing.status).toBe(404);
expect(await missing.json()).toEqual({ name: 'health-check-not-found', data: { message: 'Health check not found' } });
expect(calls.splice(0)).toEqual([...prefix, ...query]);

for (const expectedStatus of [null, 401, 0]) {
  row = { id: 'stored-check', url: 'https://example.com/health', expected_status: expectedStatus };
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: result });
  expect(calls.splice(0)).toEqual([...prefix, ...query, ['limit', 'probe:check'], ['probe', {
    healthCheckId: row.id, url: row.url, expectedStatus,
  }]]);
}
allowed = false;
const limited = await invoke();
expect(limited.status).toBe(429);
expect(limited.headers.get('Retry-After')).toBe('2');
expect(await limited.json()).toEqual({ name: 'rate-limit-exceeded', data: {
  message: 'Too many probe requests. Please wait before probing again.', retryAfterSeconds: 2,
} });
expect(calls.splice(0)).toEqual([...prefix, ...query, ['limit', 'probe:check'], ['retry', 'probe:check']]);
allowed = true;
dbError = new Error('database unavailable');
expect(await invoke().catch((error: unknown) => error)).toBe(dbError);
expect(calls.splice(0)).toEqual([...prefix, ...query]);
dbError = undefined;
probeError = new Error('probe unavailable');
expect(await invoke().catch((error: unknown) => error)).toBe(probeError);
expect(calls.splice(0)).toEqual([...prefix, ...query, ['limit', 'probe:check'], ['probe', {
  healthCheckId: 'stored-check', url: 'https://example.com/health', expectedStatus: 0,
}]]);
console.info('probe handler contract passed');
