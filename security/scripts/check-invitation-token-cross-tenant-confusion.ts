#!/usr/bin/env bun

type LoginPayload = {
  data?: {
    accessToken?: string;
    user?: {
      id?: string;
      email?: string;
    };
  };
};

type ProbeSummary = {
  checkedAt: string;
  baseUrl: string;
  normalUserEmail: string;
  adminEmail: string;
  forbiddenBoardId: string;
  forbiddenCardId: string;
  targetWorkspaceId: string | null;
  inviteToken: string | null;
  baseline: {
    boardStatus: number;
    cardStatus: number;
    workspaceStatus: number | null;
  };
  contextMutatedAccept: {
    status: number;
    accepted: boolean;
    responseBody: unknown;
    usedMismatchedHeaders: Record<string, string>;
    usedMismatchedBody: Record<string, string>;
  };
  postAccept: {
    boardStatus: number;
    cardStatus: number;
    workspaceStatus: number | null;
  };
  effects: {
    workspaceMembershipLikelyGranted: boolean;
    forbiddenBoardNowAccessible: boolean;
    forbiddenCardNowAccessible: boolean;
  };
  vulnerable: boolean;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_NORMAL_EMAIL = 'replace-test-email+test@email.com';
const DEFAULT_NORMAL_PASSWORD = 'replace-password-here';
const DEFAULT_ADMIN_EMAIL = 'admin-email@email.com';
const DEFAULT_ADMIN_PASSWORD = 'replace-password-here';
const DEFAULT_FORBIDDEN_BOARD_ID = '7WlfAtA7';
const DEFAULT_FORBIDDEN_CARD_ID = 'QqOnIdEz';

function getCliArg(name: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function getConfig() {
  const baseUrl = getCliArg('base-url') ?? Bun.env['AUDIT_BASE_URL'] ?? DEFAULT_BASE_URL;

  const normalEmail = getCliArg('normal-email') ?? Bun.env['AUDIT_NORMAL_EMAIL'] ?? DEFAULT_NORMAL_EMAIL;
  const normalPassword = getCliArg('normal-password') ?? Bun.env['AUDIT_NORMAL_PASSWORD'] ?? DEFAULT_NORMAL_PASSWORD;

  const adminEmail = getCliArg('admin-email') ?? Bun.env['AUDIT_ADMIN_EMAIL'] ?? DEFAULT_ADMIN_EMAIL;
  const adminPassword = getCliArg('admin-password') ?? Bun.env['AUDIT_ADMIN_PASSWORD'] ?? DEFAULT_ADMIN_PASSWORD;

  const forbiddenBoardId = getCliArg('board-id') ?? Bun.env['AUDIT_FORBIDDEN_BOARD_ID'] ?? DEFAULT_FORBIDDEN_BOARD_ID;
  const forbiddenCardId = getCliArg('card-id') ?? Bun.env['AUDIT_FORBIDDEN_CARD_ID'] ?? DEFAULT_FORBIDDEN_CARD_ID;

  return {
    baseUrl,
    normalEmail,
    normalPassword,
    adminEmail,
    adminPassword,
    forbiddenBoardId,
    forbiddenCardId,
  };
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

  const payload = (await parseJsonSafe(response)) as LoginPayload | null;
  if (!response.ok) {
    throw new Error(`Login failed (${email}) with status ${response.status}: ${JSON.stringify(payload)}`);
  }

  const token = payload?.data?.accessToken;
  if (!token) {
    throw new Error(`Login succeeded (${email}) but no access token was returned`);
  }

  return token;
}

async function getBoard({
  baseUrl,
  token,
  boardId,
}: {
  baseUrl: string;
  token: string;
  boardId: string;
}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}/api/v1/boards/${boardId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    status: response.status,
    body: await parseJsonSafe(response),
  };
}

async function getCard({
  baseUrl,
  token,
  cardId,
}: {
  baseUrl: string;
  token: string;
  cardId: string;
}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}/api/v1/cards/${cardId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    status: response.status,
    body: await parseJsonSafe(response),
  };
}

async function getWorkspace({
  baseUrl,
  token,
  workspaceId,
}: {
  baseUrl: string;
  token: string;
  workspaceId: string;
}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    status: response.status,
    body: await parseJsonSafe(response),
  };
}

function extractWorkspaceIdFromBoardPayload(payload: unknown): string | null {
  const data = (payload as { data?: Record<string, unknown> } | null)?.data;
  if (!data || typeof data !== 'object') return null;

  const bySnake = data.workspace_id;
  if (typeof bySnake === 'string' && bySnake.length > 0) return bySnake;

  const byCamel = data.workspaceId;
  if (typeof byCamel === 'string' && byCamel.length > 0) return byCamel;

  return null;
}

async function createWorkspaceInvite({
  baseUrl,
  adminToken,
  workspaceId,
  invitedEmail,
}: {
  baseUrl: string;
  adminToken: string;
  workspaceId: string;
  invitedEmail: string;
}): Promise<{ status: number; body: unknown; token: string | null }> {
  const response = await fetch(`${baseUrl}/api/v1/workspaces/${workspaceId}/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: invitedEmail, role: 'MEMBER' }),
  });

  const body = await parseJsonSafe(response);
  const token = (body as { data?: { token?: string } } | null)?.data?.token ?? null;

  return {
    status: response.status,
    body,
    token,
  };
}

async function inspectInvite({
  baseUrl,
  token,
}: {
  baseUrl: string;
  token: string;
}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}/api/v1/invites/${token}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return {
    status: response.status,
    body: await parseJsonSafe(response),
  };
}

async function acceptInviteWithMismatchedContext({
  baseUrl,
  normalToken,
  inviteToken,
  forbiddenBoardId,
  forbiddenCardId,
}: {
  baseUrl: string;
  normalToken: string;
  inviteToken: string;
  forbiddenBoardId: string;
  forbiddenCardId: string;
}): Promise<{
  status: number;
  body: unknown;
  mutatedHeaders: Record<string, string>;
  mutatedBody: Record<string, string>;
}> {
  // Intentionally conflicting tenant/context hints to probe trust-boundary checks.
  const mutatedHeaders: Record<string, string> = {
    'x-forwarded-host': 'workspace-a.localtest.me',
    'x-workspace-slug': 'workspace-a-slug-mismatch',
    'x-workspace-id': 'workspace-a-id-mismatch',
    'x-tenant-id': 'tenant-a-mismatch',
  };

  const mutatedBody: Record<string, string> = {
    workspaceId: 'workspace-a-id-mismatch',
    workspaceSlug: 'workspace-a-slug-mismatch',
    boardId: forbiddenBoardId,
    cardId: forbiddenCardId,
    audience: 'workspace-a',
  };

  const response = await fetch(`${baseUrl}/api/v1/invites/${inviteToken}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${normalToken}`,
      'Content-Type': 'application/json',
      ...mutatedHeaders,
    },
    body: JSON.stringify(mutatedBody),
  });

  return {
    status: response.status,
    body: await parseJsonSafe(response),
    mutatedHeaders,
    mutatedBody,
  };
}

function printUsage(): void {
  console.log(`
Invitation token cross-tenant confusion probe

Usage:
  bun run security/scripts/check-invitation-token-cross-tenant-confusion.ts [options]

Options:
  --base-url <url>             API base URL (default: ${DEFAULT_BASE_URL})
  --normal-email <email>       Normal user email
  --normal-password <pwd>      Normal user password
  --admin-email <email>        Admin email
  --admin-password <pwd>       Admin password
  --board-id <id>              Forbidden board short id (default: ${DEFAULT_FORBIDDEN_BOARD_ID})
  --card-id <id>               Forbidden card short id (default: ${DEFAULT_FORBIDDEN_CARD_ID})
  --help                       Show this help

Environment alternatives:
  AUDIT_BASE_URL, AUDIT_NORMAL_EMAIL, AUDIT_NORMAL_PASSWORD,
  AUDIT_ADMIN_EMAIL, AUDIT_ADMIN_PASSWORD,
  AUDIT_FORBIDDEN_BOARD_ID, AUDIT_FORBIDDEN_CARD_ID
`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const config = getConfig();

  console.log(`[audit] Base URL: ${config.baseUrl}`);
  console.log(`[audit] Normal account: ${config.normalEmail}`);
  console.log(`[audit] Admin account: ${config.adminEmail}`);
  console.log(`[audit] Forbidden board short ID: ${config.forbiddenBoardId}`);
  console.log(`[audit] Forbidden card short ID: ${config.forbiddenCardId}`);

  const [normalToken, adminToken] = await Promise.all([
    login({
      baseUrl: config.baseUrl,
      email: config.normalEmail,
      password: config.normalPassword,
    }),
    login({
      baseUrl: config.baseUrl,
      email: config.adminEmail,
      password: config.adminPassword,
    }),
  ]);

  console.log('[audit] Both logins succeeded. Running baseline checks...');

  const [baselineBoard, baselineCard, adminBoard] = await Promise.all([
    getBoard({ baseUrl: config.baseUrl, token: normalToken, boardId: config.forbiddenBoardId }),
    getCard({ baseUrl: config.baseUrl, token: normalToken, cardId: config.forbiddenCardId }),
    getBoard({ baseUrl: config.baseUrl, token: adminToken, boardId: config.forbiddenBoardId }),
  ]);

  const workspaceId = extractWorkspaceIdFromBoardPayload(adminBoard.body);
  if (!workspaceId) {
    throw new Error(
      `Could not resolve target workspace from admin board read (status ${adminBoard.status}): ${JSON.stringify(adminBoard.body)}`,
    );
  }

  const baselineWorkspace = await getWorkspace({
    baseUrl: config.baseUrl,
    token: normalToken,
    workspaceId,
  });

  console.log('[audit] Creating invite as admin for normal user...');

  const createdInvite = await createWorkspaceInvite({
    baseUrl: config.baseUrl,
    adminToken,
    workspaceId,
    invitedEmail: config.normalEmail,
  });

  if (!createdInvite.token) {
    throw new Error(
      `Invite creation did not return a token (status ${createdInvite.status}): ${JSON.stringify(createdInvite.body)}`,
    );
  }

  const inspect = await inspectInvite({
    baseUrl: config.baseUrl,
    token: createdInvite.token,
  });

  console.log('[audit] Accepting invite with intentionally mismatched tenant context...');

  const accepted = await acceptInviteWithMismatchedContext({
    baseUrl: config.baseUrl,
    normalToken,
    inviteToken: createdInvite.token,
    forbiddenBoardId: config.forbiddenBoardId,
    forbiddenCardId: config.forbiddenCardId,
  });

  const [postBoard, postCard, postWorkspace] = await Promise.all([
    getBoard({ baseUrl: config.baseUrl, token: normalToken, boardId: config.forbiddenBoardId }),
    getCard({ baseUrl: config.baseUrl, token: normalToken, cardId: config.forbiddenCardId }),
    getWorkspace({ baseUrl: config.baseUrl, token: normalToken, workspaceId }),
  ]);

  const workspaceMembershipLikelyGranted = baselineWorkspace.status >= 400 && postWorkspace.status >= 200 && postWorkspace.status < 300;
  const forbiddenBoardNowAccessible = postBoard.status >= 200 && postBoard.status < 300;
  const forbiddenCardNowAccessible = postCard.status >= 200 && postCard.status < 300;

  const contextMutatedAcceptAccepted = accepted.status >= 200 && accepted.status < 300;

  // Treat as vulnerable when mismatch-context acceptance succeeds and produces privilege/data boundary effects.
  const vulnerable =
    contextMutatedAcceptAccepted &&
    (workspaceMembershipLikelyGranted || forbiddenBoardNowAccessible || forbiddenCardNowAccessible);

  const summary: ProbeSummary = {
    checkedAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    normalUserEmail: config.normalEmail,
    adminEmail: config.adminEmail,
    forbiddenBoardId: config.forbiddenBoardId,
    forbiddenCardId: config.forbiddenCardId,
    targetWorkspaceId: workspaceId,
    inviteToken: createdInvite.token,
    baseline: {
      boardStatus: baselineBoard.status,
      cardStatus: baselineCard.status,
      workspaceStatus: baselineWorkspace.status,
    },
    contextMutatedAccept: {
      status: accepted.status,
      accepted: contextMutatedAcceptAccepted,
      responseBody: accepted.body,
      usedMismatchedHeaders: accepted.mutatedHeaders,
      usedMismatchedBody: accepted.mutatedBody,
    },
    postAccept: {
      boardStatus: postBoard.status,
      cardStatus: postCard.status,
      workspaceStatus: postWorkspace.status,
    },
    effects: {
      workspaceMembershipLikelyGranted,
      forbiddenBoardNowAccessible,
      forbiddenCardNowAccessible,
    },
    vulnerable,
  };

  console.log('\n=== Invitation Token Cross-Tenant Confusion Probe Result ===');
  console.log(JSON.stringify({ inviteInspect: inspect, summary }, null, 2));

  if (vulnerable) {
    console.error('\n[audit] Potential Broken Access Control / trust-boundary confusion detected.');
    process.exit(2);
  }

  console.log('\n[audit] PASS: no exploitable trust-boundary confusion observed for forbidden board/card in this run.');
}

main().catch((error) => {
  console.error('[audit] Script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
