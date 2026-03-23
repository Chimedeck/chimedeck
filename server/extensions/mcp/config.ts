// Centralised config for the MCP server.
// All env vars are read here — never access Bun.env outside this module.
const token = Bun.env.HORIFLOW_TOKEN ?? '';

if (!token) {
  console.error(
    'Error: HORIFLOW_TOKEN is not set.\n' +
      'Generate an API token in User Settings → API Tokens and set it as:\n' +
      '  export HORIFLOW_TOKEN=hf_...'
  );
  process.exit(1);
}

export const config = {
  apiUrl: Bun.env.HORIFLOW_API_URL ?? 'http://localhost:3000',
  token,
};
