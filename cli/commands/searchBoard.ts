import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
chimedeck search-board — Full-text search over cards scoped to a single board

Usage:
  chimedeck search-board --board <boardId> --query <text> [--limit <number>]

Options:
  --board <boardId>   ID of the board to search within (required)
  --query <text>      Search query (required)
  --limit <number>    Maximum number of results to return
  --help, -h          Print this help message
`.trim();

export async function runSearchBoard({
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

  const boardId = argv.board as string | undefined;
  const query = (argv.query as string | undefined) ?? (argv.q as string | undefined);
  const limit = argv.limit as number | undefined;

  if (!boardId) {
    console.error('Error: --board <boardId> is required.\nRun \'chimedeck search-board --help\' for usage.');
    process.exit(1);
  }
  if (!query) {
    console.error('Error: --query <text> is required.\nRun \'chimedeck search-board --help\' for usage.');
    process.exit(1);
  }

  const params = new URLSearchParams({ query });
  if (limit !== undefined) params.set('limit', String(limit));

  const result = await call<unknown>({
    config,
    method: 'GET',
    path: `/api/v1/boards/${boardId}/search?${params}`,
  });

  print(result, jsonMode);
}
