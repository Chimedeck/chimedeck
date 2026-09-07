import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
chimedeck get-state-transition-rules - Get state transition rules for a board

Usage:
  chimedeck get-state-transition-rules --board <boardId>

Options:
  --board <boardId>  ID of the board (required)
  --help, -h         Print this help message
`.trim();

export async function runGetStateTransitionRules({
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
    console.error('Error: --board <boardId> is required.\nRun \'chimedeck get-state-transition-rules --help\' for usage.');
    process.exit(1);
  }

  const result = await call<unknown>({
    config,
    method: 'GET',
    path: `/api/v1/boards/${boardId}/state-transitions/rules`,
  });

  print(result, jsonMode);
}
