#!/usr/bin/env bun
/**
 * taskinate CLI — calls the Taskinate REST API on behalf of the user.
 * Usage: taskinate [--token <token>] [--api-url <url>] [--json] <command> [options]
 */

import minimist from 'minimist';
import { resolveConfig } from './config';
import { print } from './output';
import { runMoveCard } from './commands/moveCard';
import { runComment } from './commands/comment';
import { runCreateCard } from './commands/createCard';
import { runEditDescription } from './commands/editDescription';
import { runSetPrice } from './commands/setPrice';
import { runInvite } from './commands/invite';

const VERSION = '0.1.0';

const USAGE = `
taskinate — Taskinate CLI

Usage:
  taskinate [global options] <command> [command options]

Global options:
  --token <value>    API token (overrides TASKINATE_TOKEN env var)
  --api-url <value>  API base URL (overrides TASKINATE_API_URL env var)
  --json             Output raw JSON (useful for scripting with jq)
  --help, -h         Print this help message
  --version, -v      Print version

Commands:
  move-card          Move a card to a different list
  comment            Add a comment to a card
  create-card        Create a new card in a list
  edit-description   Update a card's description
  set-price          Set or clear a card's price
  invite             Invite a user to a board

Run 'taskinate <command> --help' for command-specific usage.
`.trim();

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['json', 'help', 'version', 'h', 'v'],
    string: ['token', 'api-url'],
    alias: { h: 'help', v: 'version' },
    '--': true,
  });

  if (argv.version) {
    console.log(`taskinate v${VERSION}`);
    process.exit(0);
  }

  const [command] = argv._;

  // Show global help only when no command is given, or when --help is given without a command.
  if (!command || (argv.help && !command)) {
    console.log(USAGE);
    process.exit(0);
  }

  // Subcommand --help is handled inside each command module; pass control there.
  const jsonMode: boolean = argv.json;
  const config = resolveConfig({
    tokenFlag: argv.token,
    apiUrlFlag: argv['api-url'],
  });

  switch (command) {
    case 'move-card':
      await runMoveCard({ argv: argv as Record<string, unknown>, config, jsonMode });
      break;
    case 'comment':
      await runComment({ argv: argv as Record<string, unknown>, config, jsonMode });
      break;
    case 'create-card':
      await runCreateCard({ argv: argv as Record<string, unknown>, config, jsonMode });
      break;
    case 'edit-description':
      await runEditDescription({ argv: argv as Record<string, unknown>, config, jsonMode });
      break;
    case 'set-price':
      await runSetPrice({ argv: argv as Record<string, unknown>, config, jsonMode });
      break;
    case 'invite':
      await runInvite({ argv: argv as Record<string, unknown>, config, jsonMode });
      break;
    // Future subcommands are wired in here in subsequent iterations.
    default:
      console.error(`Unknown command: ${command}\nRun 'taskinate --help' for usage.`);
      process.exit(1);
  }
}

main();
