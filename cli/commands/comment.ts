import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
taskinate comment — Add a comment to a card

Usage:
  taskinate comment --card <cardId> --text <text>

Options:
  --card <cardId>  ID of the card to comment on (required)
  --text <text>    Comment text (required)
  --help, -h       Print this help message
`.trim();

export async function runComment({
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
  const text = argv.text as string | undefined;

  if (!cardId) {
    console.error('Error: --card <cardId> is required.\nRun \'taskinate comment --help\' for usage.');
    process.exit(1);
  }
  if (!text) {
    console.error('Error: --text <text> is required.\nRun \'taskinate comment --help\' for usage.');
    process.exit(1);
  }

  const result = await call<unknown>({
    config,
    method: 'POST',
    path: `/api/v1/cards/${cardId}/comments`,
    body: { text },
  });

  if (jsonMode) {
    print(result, true);
  } else {
    print(result, false);
    if (!hasData(result)) {
      console.log(`✓ Comment added to card ${cardId}`);
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
