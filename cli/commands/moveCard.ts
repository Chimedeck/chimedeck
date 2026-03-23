import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
horiflow move-card — Move a card to a different list

Usage:
  horiflow move-card --card <cardId> --list <listId> [--position <number>]

Options:
  --card <cardId>      ID of the card to move (required)
  --list <listId>      ID of the destination list (required)
  --position <number>  Position in the list (optional, 0-based)
  --help, -h           Print this help message
`.trim();

export async function runMoveCard({
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

  const cardId = argv.card as string | undefined;
  const listId = argv.list as string | undefined;
  const position = argv.position as number | undefined;

  if (!cardId) {
    console.error('Error: --card <cardId> is required.\nRun \'horiflow move-card --help\' for usage.');
    process.exit(1);
  }
  if (!listId) {
    console.error('Error: --list <listId> is required.\nRun \'horiflow move-card --help\' for usage.');
    process.exit(1);
  }

  const body: Record<string, unknown> = { listId };
  if (position !== undefined) body.position = position;

  const result = await call<unknown>({
    config,
    method: 'PATCH',
    path: `/api/v1/cards/${cardId}/move`,
    body,
  });

  if (jsonMode) {
    print(result, true);
  } else {
    print(result, false);
    if (!hasData(result)) {
      console.log(`✓ Card ${cardId} moved to list ${listId}`);
    }
  }
}

function hasData(result: unknown): boolean {
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    return 'data' in obj || 'id' in obj;
  }
  return false;
}
