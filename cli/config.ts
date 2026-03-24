// Centralised config for the taskinate CLI.
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
  const token = tokenFlag ?? Bun.env.TASKINATE_TOKEN ?? '';
  const apiUrl = apiUrlFlag ?? Bun.env.TASKINATE_API_URL ?? 'https://app.taskinate.com';

  if (!token) {
    console.error(
      'Error: No API token provided.\n' +
        '  Set TASKINATE_TOKEN or use --token <value>.\n' +
        '  Generate a token at: Settings → API Tokens'
    );
    process.exit(1);
  }

  return { token, apiUrl };
}
