#!/usr/bin/env bun
/**
 * horiflow CLI — calls the Horiflow REST API on behalf of the user.
 * Usage: horiflow [--token <token>] [--api-url <url>] [--json] <command> [options]
 */

import minimist from 'minimist';
import { resolveConfig } from './config';
import { print } from './output';

const VERSION = '0.1.0';

const USAGE = `
horiflow — Horiflow CLI

Usage:
  horiflow [global options] <command> [command options]

Global options:
  --token <value>    API token (overrides HORIFLOW_TOKEN env var)
  --api-url <value>  API base URL (overrides HORIFLOW_API_URL env var)
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

Run 'horiflow <command> --help' for command-specific usage.
`.trim();

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['json', 'help', 'version', 'h', 'v'],
    string: ['token', 'api-url'],
    alias: { h: 'help', v: 'version' },
    '--': true,
  });

  if (argv.version) {
    console.log(`horiflow v${VERSION}`);
    process.exit(0);
  }

  const [command] = argv._;

  if (argv.help || !command) {
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
    // Future subcommands are wired in here in subsequent iterations.
    default:
      console.error(`Unknown command: ${command}\nRun 'horiflow --help' for usage.`);
      process.exit(1);
  }
}

main();
