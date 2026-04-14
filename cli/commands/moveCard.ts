import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
chimedeck move-card — Move a card to a different list

Usage:
  chimedeck move-card --card <cardId> --list <listId> [--after <cardId>]

Options:
  --card <cardId>      ID of the card to move (required)
  --list <listId>      ID of the destination list (required)
  --after <cardId>     Insert after this card ID in the destination list (optional)
  --position <number>  Deprecated. Only 0 is supported and maps to moving to the top.
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
  const afterCardId = argv.after as string | undefined;
  const position = argv.position as number | undefined;

  if (!cardId) {
    console.error('Error: --card <cardId> is required.\nRun \'chimedeck move-card --help\' for usage.');
    process.exit(1);
  }
  if (!listId) {
    console.error('Error: --list <listId> is required.\nRun \'chimedeck move-card --help\' for usage.');
    process.exit(1);
  }

  const body: Record<string, unknown> = { targetListId: listId };
  if (afterCardId !== undefined) {
    body.afterCardId = afterCardId;
  } else if (position !== undefined) {
    if (position !== 0) {
      console.error(
        "Error: --position is deprecated and only supports 0. Use --after <cardId> for explicit placement.\nRun 'chimedeck move-card --help' for usage.",
      );
      process.exit(1);
    }
    body.afterCardId = null;
  }

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
