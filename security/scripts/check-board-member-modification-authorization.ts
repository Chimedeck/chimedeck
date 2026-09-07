#!/usr/bin/env bun

type LoginSuccess = {
  data?: {
    accessToken?: string;
    user?: {
      id?: string;
      email?: string;
    };
  };
};

type BoardMember = {
  id?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | string;
  email?: string;
  name?: string;
};

type ProbeSummary = {
  checkedAt: string;
  baseUrl: string;
  loginAccount: string;
  boardShortId: string;
  targetUserId: string;
  attemptedRole: string;
  beforeRole: string | null;
  mutationStatus: number;
  mutationBody: unknown;
  mutationAccepted: boolean;
  afterRole: string | null;
  roleChanged: boolean;
  rollbackAttempted: boolean;
  rollbackStatus: number | null;
  rollbackSucceeded: boolean;
  vulnerable: boolean;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_EMAIL = 'replace-test-email@email.com';
const DEFAULT_PASSWORD = 'replace-it-here';
const DEFAULT_BOARD_SHORT_ID = '7WlfAtA7';
const DEFAULT_TARGET_USER_ID = '65ee7377f5eb0ee4c72c104e';
const DEFAULT_ATTEMPT_ROLE = 'ADMIN';

function getCliArg(name: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function getConfig() {
  const baseUrl = getCliArg('base-url') ?? Bun.env['AUDIT_BASE_URL'] ?? DEFAULT_BASE_URL;
  const email = getCliArg('email') ?? Bun.env['AUDIT_EMAIL'] ?? DEFAULT_EMAIL;
  const password = getCliArg('password') ?? Bun.env['AUDIT_PASSWORD'] ?? DEFAULT_PASSWORD;
  const boardId = getCliArg('board-id') ?? Bun.env['AUDIT_BOARD_ID'] ?? DEFAULT_BOARD_SHORT_ID;
  const targetUserId = getCliArg('target-user-id') ?? Bun.env['AUDIT_TARGET_USER_ID'] ?? DEFAULT_TARGET_USER_ID;
  const attemptRole = getCliArg('role') ?? Bun.env['AUDIT_ATTEMPT_ROLE'] ?? DEFAULT_ATTEMPT_ROLE;
  const rollback = (getCliArg('rollback') ?? Bun.env['AUDIT_ROLLBACK'] ?? 'true').toLowerCase() !== 'false';

  return { baseUrl, email, password, boardId, targetUserId, attemptRole, rollback };
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function login({
  baseUrl,
  email,
  password,
}: {
  baseUrl: string;
  email: string;
  password: string;
}): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await parseJsonSafe(response)) as LoginSuccess | null;
  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}: ${JSON.stringify(payload)}`);
  }

  const token = payload?.data?.accessToken;
  if (!token) {
    throw new Error(`Login succeeded but no access token was returned: ${JSON.stringify(payload)}`);
  }

  return token;
}

async function listBoardMembers({
  baseUrl,
  boardId,
  token,
}: {
  baseUrl: string;
  boardId: string;
  token: string;
}): Promise<{ status: number; body: unknown; members: BoardMember[] }> {
  const response = await fetch(`${baseUrl}/api/v1/boards/${boardId}/members`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await parseJsonSafe(response);
  const members = Array.isArray((body as { data?: unknown })?.data)
    ? (((body as { data?: unknown }).data as unknown[]) as BoardMember[])
    : [];

  return { status: response.status, body, members };
}

async function patchMemberRole({
  baseUrl,
  boardId,
  targetUserId,
  role,
  token,
}: {
  baseUrl: string;
  boardId: string;
  targetUserId: string;
  role: string;
  token: string;
}): Promise<{ status: number; body: unknown; ok: boolean }> {
  const response = await fetch(`${baseUrl}/api/v1/boards/${boardId}/members/${targetUserId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  });

  const body = await parseJsonSafe(response);
  return { status: response.status, body, ok: response.ok };
}

function printUsage(): void {
  console.log(`
Board member modification authorization probe

Usage:
  bun run security/scripts/check-board-member-modification-authorization.ts [options]

Options:
  --base-url <url>          API base URL (default: ${DEFAULT_BASE_URL})
  --email <email>           Login email
  --password <password>     Login password
  --board-id <id>           Board short/full ID (default: ${DEFAULT_BOARD_SHORT_ID})
  --target-user-id <id>     Member user ID to mutate (default: ${DEFAULT_TARGET_USER_ID})
  --role <ADMIN|MEMBER>     Role to attempt setting (default: ${DEFAULT_ATTEMPT_ROLE})
  --rollback <true|false>   Revert to original role if changed (default: true)
  --help                    Show this help

Environment alternatives:
  AUDIT_BASE_URL, AUDIT_EMAIL, AUDIT_PASSWORD, AUDIT_BOARD_ID,
  AUDIT_TARGET_USER_ID, AUDIT_ATTEMPT_ROLE, AUDIT_ROLLBACK
`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const { baseUrl, email, password, boardId, targetUserId, attemptRole, rollback } = getConfig();

  console.log(`[audit] Base URL: ${baseUrl}`);
  console.log(`[audit] Login account: ${email}`);
  console.log(`[audit] Target board: ${boardId}`);
  console.log(`[audit] Target member user ID: ${targetUserId}`);
  console.log(`[audit] Attempted role mutation: ${attemptRole}`);

  const token = await login({ baseUrl, email, password });
  console.log('[audit] Login successful.');

  const before = await listBoardMembers({ baseUrl, boardId, token });
  const beforeMember = before.members.find((member) => member.id === targetUserId);
  const beforeRole = beforeMember?.role ?? null;

  if (before.status >= 400 && before.status !== 403) {
    throw new Error(`Unable to read board members before probe (status ${before.status}): ${JSON.stringify(before.body)}`);
  }

  const mutation = await patchMemberRole({
    baseUrl,
    boardId,
    targetUserId,
    role: attemptRole,
    token,
  });

  const after = await listBoardMembers({ baseUrl, boardId, token });
  const afterMember = after.members.find((member) => member.id === targetUserId);
  const afterRole = afterMember?.role ?? null;

  const mutationAccepted = mutation.status >= 200 && mutation.status < 300;
  const roleChanged = Boolean(beforeRole && afterRole && beforeRole !== afterRole);

  let rollbackAttempted = false;
  let rollbackStatus: number | null = null;
  let rollbackSucceeded = false;

  if (rollback && roleChanged && beforeRole) {
    rollbackAttempted = true;
    const rollbackResult = await patchMemberRole({
      baseUrl,
      boardId,
      targetUserId,
      role: beforeRole,
      token,
    });
    rollbackStatus = rollbackResult.status;
    rollbackSucceeded = rollbackResult.status >= 200 && rollbackResult.status < 300;
  }

  // Vulnerable if unauthorized caller can successfully execute role mutation endpoint.
  const vulnerable = mutationAccepted;

  const summary: ProbeSummary = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    loginAccount: email,
    boardShortId: boardId,
    targetUserId,
    attemptedRole: attemptRole,
    beforeRole,
    mutationStatus: mutation.status,
    mutationBody: mutation.body,
    mutationAccepted,
    afterRole,
    roleChanged,
    rollbackAttempted,
    rollbackStatus,
    rollbackSucceeded,
    vulnerable,
  };

  console.log('\n=== Board Member Modification Probe Result ===');
  console.log(JSON.stringify(summary, null, 2));

  if (vulnerable) {
    console.error('\n[audit] Potential BOLA detected: role mutation endpoint accepted the request.');
    process.exit(2);
  }

  console.log('\n[audit] PASS: role mutation was blocked for this account.');
}

main().catch((error) => {
  console.error('[audit] Script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
