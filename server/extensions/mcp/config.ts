// Centralised config for the MCP server.
// All env vars are read here — never access Bun.env outside this module.
// Note: no startup validation here — the stdio entrypoint validates at runtime;
//       the HTTP handler uses the caller's own token from the Authorization header.
export const config = {
  apiUrl: Bun.env.TASKINATE_API_URL ?? 'http://localhost:3000',
  token: Bun.env.TASKINATE_TOKEN ?? '',
};
