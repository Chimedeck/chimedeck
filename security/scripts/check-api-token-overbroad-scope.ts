#!/usr/bin/env bun

type LoginResponse = {
  data?: {
    accessToken?: string;
    user?: {
      id?: string;
      email?: string;
    };
  };
};

type CreateTokenResponse = {
  data?: {
    id?: string;
    token?: string;
    name?: string;
    prefix?: string;
    expiresAt?: string | null;
    createdAt?: string;
  };
};

type ProbeSummary = {
  checkedAt: string;
  baseUrl: string;
  normalUserEmail: string;
  adminEmail: string;
  forbiddenBoardId: string;
  forbiddenCardId: string;
  token: {
    created: boolean;
    tokenId: string | null;
    tokenPrefix: string | null;
    baselineListTokensStatus: number;
  };
  jwtReference: {
    boardReadStatus: number;
    cardReadStatus: number;
    boardFollowStatus: number;
  };
  apiTokenProbes: {
    boardReadStatus: number;
    cardReadStatus: number;
    boardFollowStatus: number;
    boardFollowBody: unknown;
    rollbackUnfollowAttempted: boolean;
    rollbackUnfollowStatus: number | null;
  };
  vulnerable: boolean;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_NORMAL_EMAIL = 'replace-test-email@email.com';
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
  return {
    baseUrl: getCliArg('base-url') ?? Bun.env['AUDIT_BASE_URL'] ?? DEFAULT_BASE_URL,
    normalEmail: getCliArg('normal-email') ?? Bun.env['AUDIT_NORMAL_EMAIL'] ?? DEFAULT_NORMAL_EMAIL,
    normalPassword: getCliArg('normal-password') ?? Bun.env['AUDIT_NORMAL_PASSWORD'] ?? DEFAULT_NORMAL_PASSWORD,
    adminEmail: getCliArg('admin-email') ?? Bun.env['AUDIT_ADMIN_EMAIL'] ?? DEFAULT_ADMIN_EMAIL,
    adminPassword: getCliArg('admin-password') ?? Bun.env['AUDIT_ADMIN_PASSWORD'] ?? DEFAULT_ADMIN_PASSWORD,
    forbiddenBoardId: getCliArg('board-id') ?? Bun.env['AUDIT_FORBIDDEN_BOARD_ID'] ?? DEFAULT_FORBIDDEN_BOARD_ID,
    forbiddenCardId: getCliArg('card-id') ?? Bun.env['AUDIT_FORBIDDEN_CARD_ID'] ?? DEFAULT_FORBIDDEN_CARD_ID,
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

  const payload = (await parseJsonSafe(response)) as LoginResponse | null;
  if (!response.ok) {
    throw new Error(`Login failed (${email}) with status ${response.status}: ${JSON.stringify(payload)}`);
  }

  const accessToken = payload?.data?.accessToken;
  if (!accessToken) {
    throw new Error(`Login succeeded (${email}) but no access token returned`);
  }

  return accessToken;
}

async function createApiToken({
  baseUrl,
  jwt,
}: {
  baseUrl: string;
  jwt: string;
}): Promise<{ status: number; body: unknown; tokenId: string | null; rawToken: string | null; prefix: string | null }> {
  const name = `audit-overbroad-scope-${Date.now()}`;
  const response = await fetch(`${baseUrl}/api/v1/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, expiresAt: null }),
  });

  const body = (await parseJsonSafe(response)) as CreateTokenResponse | null;

  return {
    status: response.status,
    body,
    tokenId: body?.data?.id ?? null,
    rawToken: body?.data?.token ?? null,
    prefix: body?.data?.prefix ?? null,
  };
}

async function apiCall({
  baseUrl,
  token,
  method,
  path,
}: {
  baseUrl: string;
  token: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
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

function printUsage(): void {
  console.log(`
API token overbroad-scope probe

Usage:
  bun run security/scripts/check-api-token-overbroad-scope.ts [options]

Options:
  --base-url <url>             API base URL (default: ${DEFAULT_BASE_URL})
  --normal-email <email>       Normal user email
  --normal-password <pwd>      Normal user password
  --admin-email <email>        Admin user email
  --admin-password <pwd>       Admin user password
  --board-id <id>              Forbidden board short ID (default: ${DEFAULT_FORBIDDEN_BOARD_ID})
  --card-id <id>               Forbidden card short ID (default: ${DEFAULT_FORBIDDEN_CARD_ID})
  --help                       Show this help
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

  const [normalJwt, adminJwt] = await Promise.all([
    login({ baseUrl: config.baseUrl, email: config.normalEmail, password: config.normalPassword }),
    login({ baseUrl: config.baseUrl, email: config.adminEmail, password: config.adminPassword }),
  ]);

  // Confirm target identifiers are valid and accessible to admin.
  const adminBoardCheck = await apiCall({
    baseUrl: config.baseUrl,
    token: adminJwt,
    method: 'GET',
    path: `/api/v1/boards/${config.forbiddenBoardId}`,
  });
  const adminCardCheck = await apiCall({
    baseUrl: config.baseUrl,
    token: adminJwt,
    method: 'GET',
    path: `/api/v1/cards/${config.forbiddenCardId}`,
  });

  if (adminBoardCheck.status < 200 || adminBoardCheck.status >= 300) {
    throw new Error(`Admin cannot access target board (status ${adminBoardCheck.status}).`);
  }
  if (adminCardCheck.status < 200 || adminCardCheck.status >= 300) {
    throw new Error(`Admin cannot access target card (status ${adminCardCheck.status}).`);
  }

  // JWT reference behavior for the normal user.
  const [jwtBoardRead, jwtCardRead, jwtBoardFollow] = await Promise.all([
    apiCall({
      baseUrl: config.baseUrl,
      token: normalJwt,
      method: 'GET',
      path: `/api/v1/boards/${config.forbiddenBoardId}`,
    }),
    apiCall({
      baseUrl: config.baseUrl,
      token: normalJwt,
      method: 'GET',
      path: `/api/v1/cards/${config.forbiddenCardId}`,
    }),
    apiCall({
      baseUrl: config.baseUrl,
      token: normalJwt,
      method: 'POST',
      path: `/api/v1/boards/${config.forbiddenBoardId}/follow`,
    }),
  ]);

  const createdToken = await createApiToken({
    baseUrl: config.baseUrl,
    jwt: normalJwt,
  });

  if (!createdToken.rawToken || createdToken.status < 200 || createdToken.status >= 300) {
    throw new Error(`Unable to create API token (status ${createdToken.status}): ${JSON.stringify(createdToken.body)}`);
  }

  const apiToken = createdToken.rawToken;

  const baselineListTokens = await apiCall({
    baseUrl: config.baseUrl,
    token: apiToken,
    method: 'GET',
    path: '/api/v1/tokens',
  });

  const [apiBoardRead, apiCardRead, apiBoardFollow] = await Promise.all([
    apiCall({
      baseUrl: config.baseUrl,
      token: apiToken,
      method: 'GET',
      path: `/api/v1/boards/${config.forbiddenBoardId}`,
    }),
    apiCall({
      baseUrl: config.baseUrl,
      token: apiToken,
      method: 'GET',
      path: `/api/v1/cards/${config.forbiddenCardId}`,
    }),
    apiCall({
      baseUrl: config.baseUrl,
      token: apiToken,
      method: 'POST',
      path: `/api/v1/boards/${config.forbiddenBoardId}/follow`,
    }),
  ]);

  let rollbackUnfollowAttempted = false;
  let rollbackUnfollowStatus: number | null = null;

  if (apiBoardFollow.status >= 200 && apiBoardFollow.status < 300) {
    rollbackUnfollowAttempted = true;
    const rollback = await apiCall({
      baseUrl: config.baseUrl,
      token: apiToken,
      method: 'DELETE',
      path: `/api/v1/boards/${config.forbiddenBoardId}/follow`,
    });
    rollbackUnfollowStatus = rollback.status;
  }

  const forbiddenApiReadOrWriteSucceeded =
    (apiBoardRead.status >= 200 && apiBoardRead.status < 300) ||
    (apiCardRead.status >= 200 && apiCardRead.status < 300) ||
    (apiBoardFollow.status >= 200 && apiBoardFollow.status < 300);

  // Flag mismatch when API token succeeds where JWT reference is denied for same user.
  const jwtDeniedButApiTokenAllowed =
    (jwtBoardRead.status >= 400 && apiBoardRead.status >= 200 && apiBoardRead.status < 300) ||
    (jwtCardRead.status >= 400 && apiCardRead.status >= 200 && apiCardRead.status < 300) ||
    (jwtBoardFollow.status >= 400 && apiBoardFollow.status >= 200 && apiBoardFollow.status < 300);

  const vulnerable = forbiddenApiReadOrWriteSucceeded || jwtDeniedButApiTokenAllowed;

  const summary: ProbeSummary = {
    checkedAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    normalUserEmail: config.normalEmail,
    adminEmail: config.adminEmail,
    forbiddenBoardId: config.forbiddenBoardId,
    forbiddenCardId: config.forbiddenCardId,
    token: {
      created: true,
      tokenId: createdToken.tokenId,
      tokenPrefix: createdToken.prefix,
      baselineListTokensStatus: baselineListTokens.status,
    },
    jwtReference: {
      boardReadStatus: jwtBoardRead.status,
      cardReadStatus: jwtCardRead.status,
      boardFollowStatus: jwtBoardFollow.status,
    },
    apiTokenProbes: {
      boardReadStatus: apiBoardRead.status,
      cardReadStatus: apiCardRead.status,
      boardFollowStatus: apiBoardFollow.status,
      boardFollowBody: apiBoardFollow.body,
      rollbackUnfollowAttempted,
      rollbackUnfollowStatus,
    },
    vulnerable,
  };

  console.log('\n=== API Token Overbroad Scope Probe Result ===');
  console.log(JSON.stringify(summary, null, 2));

  if (vulnerable) {
    console.error('\n[audit] Potential overbroad API-token scope / horizontal privilege escalation detected.');
    process.exit(2);
  }

  console.log('\n[audit] PASS: API token did not bypass tenant boundary for tested board/card operations.');
}

main().catch((error) => {
  console.error('[audit] Script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
