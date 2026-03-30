import { captureError } from '../monitoring/sentry';

/**
 * Handle an unhandled server exception:
 *   1. Capture in Sentry (no-op when Sentry is disabled or uninitialized).
 *   2. Return a 500 JSON response in the standard API error envelope.
 *   3. If building the JSON response itself throws, return a plain-text fallback
 *      so the server always responds rather than hanging.
 */
export function handleUnhandledError(err: unknown): Response {
  try {
    captureError(err);
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    return Response.json(
      { error: { code: 'internal-server-error', message } },
      { status: 500 }
    );
  } catch {
    // Last-resort fallback — keep the server alive even if JSON serialisation fails.
    return new Response('Internal Server Error', { status: 500 });
  }
}
