import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
taskinate get-card — Retrieve full details of a card

Usage:
  taskinate get-card --card <cardId>

Options:
  --card <cardId>  ID of the card to retrieve (required)
  --help, -h       Print this help message
`.trim();

export async function runGetCard({
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

  if (!cardId) {
    console.error('Error: --card <cardId> is required.\nRun \'taskinate get-card --help\' for usage.');
    process.exit(1);
  }

  const result = await call<unknown>({
    config,
    method: 'GET',
    path: `/api/v1/cards/${cardId}`,
  });

  print(result, jsonMode);
}
