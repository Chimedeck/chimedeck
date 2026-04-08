import type { CliConfig } from '../config';
import { call } from '../apiClient';
import { print } from '../output';

const USAGE = `
chimedeck invite — Invite a user to a board

Usage:
  chimedeck invite --board <boardId> --email <email> [--role <role>]

Options:
  --board <boardId>   ID of the board (required)
  --email <email>     Email address of the user to invite (required)
  --role <role>       Role to assign: member | admin (default: member)
  --help, -h          Print this help message

Notes:
  Requires admin permission on the board. A 403 error is shown clearly if permission is lacking.
`.trim();

export async function runInvite({
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
  const email = argv.email as string | undefined;
  const role = (argv.role as string | undefined) ?? 'member';

  if (!boardId) {
    console.error("Error: --board <boardId> is required.\nRun 'chimedeck invite --help' for usage.");
    process.exit(1);
  }
  if (!email) {
    console.error("Error: --email <email> is required.\nRun 'chimedeck invite --help' for usage.");
    process.exit(1);
  }

  const result = await call<unknown>({
    config,
    method: 'POST',
    path: `/api/v1/boards/${boardId}/members`,
    body: { email, role },
  });

  if (jsonMode) {
    print(result, true);
  } else {
    print(result, false);
    if (!hasData(result)) {
      console.log(`✓ Invited ${email} to board ${boardId} as ${role}`);
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
