// Minimal request logger middleware.
export function logRequest(req: Request, status: number, durationMs: number): void {
  const method = req.method;
  const url = new URL(req.url).pathname;
  const ts = new Date().toISOString();
  console.info(`[${ts}] ${method} ${url} → ${status} (${durationMs}ms)`);
}
