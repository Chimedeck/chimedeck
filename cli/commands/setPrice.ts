import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
horiflow set-price — Set or clear a card's price

Usage:
  horiflow set-price --card <cardId> --amount <number> --currency <code> [--label <text>]
  horiflow set-price --card <cardId> --clear

Options:
  --card <cardId>      ID of the card (required)
  --amount <number>    Price amount (required unless --clear is used)
  --currency <code>    ISO 4217 currency code, e.g. USD (required unless --clear is used)
  --label <text>       Optional display label for the price
  --clear              Clear the price (sets amount to null); takes precedence over --amount
  --help, -h           Print this help message

Notes:
  If both --amount and --clear are provided, --clear takes precedence and the price is removed.
`.trim();

export async function runSetPrice({
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
  const clear = Boolean(argv.clear);
  const amount = argv.amount as number | undefined;
  const currency = argv.currency as string | undefined;
  const label = argv.label as string | undefined;

  if (!cardId) {
    console.error("Error: --card <cardId> is required.\nRun 'horiflow set-price --help' for usage.");
    process.exit(1);
  }

  // --clear takes precedence over --amount/--currency
  if (!clear) {
    if (amount === undefined) {
      console.error("Error: --amount <number> is required (or use --clear to remove the price).\nRun 'horiflow set-price --help' for usage.");
      process.exit(1);
    }
    if (!currency) {
      console.error("Error: --currency <code> is required (or use --clear to remove the price).\nRun 'horiflow set-price --help' for usage.");
      process.exit(1);
    }
  }

  const body: Record<string, unknown> = clear
    ? { amount: null }
    : { amount, currency };

  if (!clear && label !== undefined) {
    body.label = label;
  }

  const result = await call<unknown>({
    config,
    method: 'PATCH',
    path: `/api/v1/cards/${cardId}/money`,
    body,
  });

  if (jsonMode) {
    print(result, true);
  } else {
    print(result, false);
    if (!hasData(result)) {
      if (clear) {
        console.log(`✓ Price cleared for card ${cardId}`);
      } else {
        console.log(`✓ Price set to ${amount} ${currency} for card ${cardId}`);
      }
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
