import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
chimedeck copy-state-transitions - Copy state transition graph to another board

Usage:
  chimedeck copy-state-transitions --board <sourceBoardId> --target-board <targetBoardId> [--copy-enabled <true|false>]

Options:
  --board <boardId>           Source board ID (required)
  --target-board <boardId>    Target board ID (required)
  --copy-enabled <bool>       Copy enabled flag from source when true (default true)
  --help, -h                  Print this help message
`.trim();

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

export async function runCopyStateTransitions({
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
  const targetBoardId = argv['target-board'] as string | undefined;
  if (!boardId) {
    console.error('Error: --board <boardId> is required.\nRun \'chimedeck copy-state-transitions --help\' for usage.');
    process.exit(1);
  }
  if (!targetBoardId) {
    console.error('Error: --target-board <boardId> is required.\nRun \'chimedeck copy-state-transitions --help\' for usage.');
    process.exit(1);
  }

  const copyEnabledRaw = argv['copy-enabled'];
  const copyEnabled = copyEnabledRaw === undefined ? undefined : parseBoolean(copyEnabledRaw);
  if (copyEnabledRaw !== undefined && copyEnabled === null) {
    console.error('Error: --copy-enabled must be true or false.');
    process.exit(1);
  }

  const body: Record<string, unknown> = { targetBoardId };
  if (copyEnabled !== undefined) {
    body.copyEnabled = copyEnabled;
  }

  const result = await call<unknown>({
    config,
    method: 'POST',
    path: `/api/v1/boards/${boardId}/state-transitions/copy`,
    body,
  });

  print(result, jsonMode);
}
