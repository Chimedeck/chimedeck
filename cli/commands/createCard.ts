import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
taskinate create-card — Create a new card in a list

Usage:
  taskinate create-card --list <listId> --title <title> [--description <text>]

Options:
  --list <listId>        ID of the list to create the card in (required)
  --title <title>        Title of the card (required)
  --description <text>   Description of the card (optional)
  --help, -h             Print this help message
`.trim();

export async function runCreateCard({
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

  const listId = argv.list as string | undefined;
  const title = argv.title as string | undefined;
  const description = argv.description as string | undefined;

  if (!listId) {
    console.error('Error: --list <listId> is required.\nRun \'taskinate create-card --help\' for usage.');
    process.exit(1);
  }
  if (!title) {
    console.error('Error: --title <title> is required.\nRun \'taskinate create-card --help\' for usage.');
    process.exit(1);
  }

  const body: Record<string, unknown> = { title };
  if (description !== undefined) body.description = description;

  const result = await call<unknown>({
    config,
    method: 'POST',
    path: `/api/v1/lists/${listId}/cards`,
    body,
  });

  if (jsonMode) {
    print(result, true);
  } else {
    const cardId = extractCardId(result);
    print(result, false);
    if (!cardId) {
      console.log(`✓ Card created in list ${listId}`);
    } else {
      console.log(`✓ Card created: ${cardId}`);
    }
  }
}

function extractCardId(result: unknown): string | undefined {
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      return (obj.data as Record<string, unknown>).id as string | undefined;
    }
    return obj.id as string | undefined;
  }
  return undefined;
}
