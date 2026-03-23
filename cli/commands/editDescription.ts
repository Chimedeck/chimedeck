import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
horiflow edit-description — Update a card's description

Usage:
  horiflow edit-description --card <cardId> --description <text>

Options:
  --card <cardId>        ID of the card to update (required)
  --description <text>   New description text (required)
  --help, -h             Print this help message
`.trim();

export async function runEditDescription({
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
  const description = argv.description as string | undefined;

  if (!cardId) {
    console.error('Error: --card <cardId> is required.\nRun \'horiflow edit-description --help\' for usage.');
    process.exit(1);
  }
  if (description === undefined) {
    console.error('Error: --description <text> is required.\nRun \'horiflow edit-description --help\' for usage.');
    process.exit(1);
  }

  const result = await call<unknown>({
    config,
    method: 'PATCH',
    path: `/api/v1/cards/${cardId}/description`,
    body: { description },
  });

  if (jsonMode) {
    print(result, true);
  } else {
    print(result, false);
    if (!hasData(result)) {
      console.log(`✓ Description updated for card ${cardId}`);
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
