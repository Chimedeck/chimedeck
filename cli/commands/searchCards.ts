import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
taskinate search-cards — Full-text search over cards within a workspace

Usage:
  taskinate search-cards --workspace <workspaceId> --query <text> [--limit <number>]

Options:
  --workspace <workspaceId>  ID of the workspace to search within (required)
  --query <text>             Search query (required)
  --limit <number>           Maximum number of results to return (default: 20)
  --help, -h                 Print this help message
`.trim();

export async function runSearchCards({
  argv,
  config,
  jsonMode,
}: {
  argv: Record<string, unknown>;
  config: CliConfig;
  jsonMode: boolean;
}): Promise<void> {
  if (argv.help || argv.h) {
    console.log(USAGE);
    process.exit(0);
  }

  const workspaceId = argv.workspace as string | undefined;
  const query = argv.query as string | undefined;
  const limit = argv.limit as number | undefined;

  if (!workspaceId) {
    console.error('Error: --workspace <workspaceId> is required.\nRun \'taskinate search-cards --help\' for usage.');
    process.exit(1);
  }
  if (!query) {
    console.error('Error: --query <text> is required.\nRun \'taskinate search-cards --help\' for usage.');
    process.exit(1);
  }

  const params = new URLSearchParams({ q: query });
  if (limit !== undefined) params.set('limit', String(limit));

  const result = await call<unknown>({
    config,
    method: 'GET',
    path: `/api/v1/workspaces/${workspaceId}/search?${params}`,
  });

  print(result, jsonMode);
}
