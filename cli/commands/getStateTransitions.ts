import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
chimedeck get-state-transitions - Get state transition graph for a board

Usage:
  chimedeck get-state-transitions --board <boardId>

Options:
  --board <boardId>  ID of the board (required)
  --help, -h         Print this help message
`.trim();

export async function runGetStateTransitions({
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
  if (!boardId) {
    console.error('Error: --board <boardId> is required.\nRun \'chimedeck get-state-transitions --help\' for usage.');
    process.exit(1);
  }

  const result = await call<unknown>({
    config,
    method: 'GET',
    path: `/api/v1/boards/${boardId}/state-transitions`,
  });

  print(result, jsonMode);
}
