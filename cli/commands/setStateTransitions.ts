import { readFileSync } from 'node:fs';
import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
chimedeck set-state-transitions - Update state transition graph/enabled flag for a board

Usage:
  chimedeck set-state-transitions --board <boardId> [--enabled <true|false>] [--graph-json '<json>'] [--graph-file <path>]

Options:
  --board <boardId>       Board ID (required)
  --enabled <true|false>  Enabled flag
  --graph-json <json>     Graph JSON string
  --graph-file <path>     Path to a JSON file containing graph
  --help, -h              Print this help message

At least one of --enabled, --graph-json, or --graph-file must be provided.
`.trim();

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

function ensureGraphObject(value: unknown, sourceFlag: '--graph-json' | '--graph-file'): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  console.error(`Error: ${sourceFlag} must contain a JSON object.`);
  process.exit(1);
}

function parseGraphInput(argv: Record<string, unknown>): Record<string, unknown> | undefined {
  const graphJson = argv['graph-json'];
  const graphFile = argv['graph-file'];

  if (graphJson !== undefined && graphFile !== undefined) {
    console.error('Error: provide only one of --graph-json or --graph-file.');
    process.exit(1);
  }

  if (graphJson !== undefined) {
    if (typeof graphJson !== 'string' || graphJson.trim() === '') {
      console.error('Error: --graph-json must be a non-empty JSON string.');
      process.exit(1);
    }
    try {
      const parsed = JSON.parse(graphJson);
      return ensureGraphObject(parsed, '--graph-json');
    } catch {
      console.error('Error: --graph-json is not valid JSON.');
      process.exit(1);
    }
  }

  if (graphFile !== undefined) {
    if (typeof graphFile !== 'string' || graphFile.trim() === '') {
      console.error('Error: --graph-file must be a valid file path.');
      process.exit(1);
    }
    try {
      const raw = readFileSync(graphFile, 'utf8');
      const parsed = JSON.parse(raw);
      return ensureGraphObject(parsed, '--graph-file');
    } catch {
      console.error('Error: failed to read or parse JSON from --graph-file.');
      process.exit(1);
    }
  }

  return undefined;
}

export async function runSetStateTransitions({
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
  if (!boardId) {
    console.error('Error: --board <boardId> is required.\nRun \'chimedeck set-state-transitions --help\' for usage.');
    process.exit(1);
  }

  const enabledRaw = argv.enabled;
  const enabled = enabledRaw === undefined ? undefined : parseBoolean(enabledRaw);
  if (enabledRaw !== undefined && enabled === null) {
    console.error('Error: --enabled must be true or false.');
    process.exit(1);
  }

  const graph = parseGraphInput(argv);

  if (enabled === undefined && graph === undefined) {
    console.error('Error: provide at least one of --enabled, --graph-json, or --graph-file.');
    process.exit(1);
  }

  const body: Record<string, unknown> = {};
  if (enabled !== undefined) body.enabled = enabled;
  if (graph !== undefined) body.graph = graph;

  const result = await call<unknown>({
    config,
    method: 'PUT',
    path: `/api/v1/boards/${boardId}/state-transitions`,
    body,
  });

  print(result, jsonMode);
}
