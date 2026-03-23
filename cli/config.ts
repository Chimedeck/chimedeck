// Centralised config for the horiflow CLI.
// All env vars are read here — never access Bun.env outside this module.

export interface CliConfig {
  token: string;
  apiUrl: string;
}

export function resolveConfig({
  tokenFlag,
  apiUrlFlag,
}: {
  tokenFlag?: string;
  apiUrlFlag?: string;
}): CliConfig {
  const token = tokenFlag ?? Bun.env.HORIFLOW_TOKEN ?? '';
  const apiUrl = apiUrlFlag ?? Bun.env.HORIFLOW_API_URL ?? 'https://app.horiflow.com';

  if (!token) {
    console.error(
      'Error: No API token provided.\n' +
        '  Set HORIFLOW_TOKEN or use --token <value>.\n' +
        '  Generate a token at: Settings → API Tokens'
    );
    process.exit(1);
  }

  return { token, apiUrl };
}
