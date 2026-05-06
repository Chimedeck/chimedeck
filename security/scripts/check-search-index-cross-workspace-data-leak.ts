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

type SearchResponse = {
  data?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

type AccountProbeSummary = {
  email: string;
  baseline: {
    boardReadStatus: number;
    cardReadStatus: number;
  };
  search: {
    workspaceSearchStatus: number;
    boardSearchStatus: number;
    workspaceResultCount: number;
    boardResultCount: number;
    leakedForbiddenBoardInWorkspaceSearch: boolean;
    leakedForbiddenCardInWorkspaceSearch: boolean;
    leakedForbiddenBoardInBoardSearch: boolean;
    leakedForbiddenCardInBoardSearch: boolean;
  };
  vulnerable: boolean;
};

type ProbeSummary = {
  checkedAt: string;
  baseUrl: string;
  target: {
    forbiddenBoardId: string;
    forbiddenCardId: string;
    workspaceId: string | null;
    markerQuery: string;
  };
  admin: {
    email: string;
    boardReadStatus: number;
    cardReadStatus: number;
  };
  probes: {
    normal: AccountProbeSummary;
    pristine: AccountProbeSummary;
  };
  vulnerable: boolean;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_NORMAL_EMAIL = 'replace-test-email@email.com';
const DEFAULT_NORMAL_PASSWORD = 'replace-password-here';
const DEFAULT_ADMIN_EMAIL = 'admin-email@email.com';
const DEFAULT_ADMIN_PASSWORD = 'replace-password-here';
const DEFAULT_PRISTINE_EMAIL = 'replace-test-email+test@email.com';
const DEFAULT_PRISTINE_PASSWORD = 'replace-password-here';
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
    pristineEmail: getCliArg('pristine-email') ?? Bun.env['AUDIT_PRISTINE_EMAIL'] ?? DEFAULT_PRISTINE_EMAIL,
    pristinePassword: getCliArg('pristine-password') ?? Bun.env['AUDIT_PRISTINE_PASSWORD'] ?? DEFAULT_PRISTINE_PASSWORD,
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

  const token = payload?.data?.accessToken;
  if (!token) {
    throw new Error(`Login succeeded (${email}) but no access token returned`);
  }

  return token;
}

async function apiGet({
  baseUrl,
  token,
  path,
}: {
  baseUrl: string;
  token: string;
  path: string;
}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
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

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number') return String(value).toLowerCase();
  return '';
}

function searchLeakInResults({
  results,
  forbiddenBoardId,
  forbiddenCardId,
}: {
  results: Array<Record<string, unknown>>;
  forbiddenBoardId: string;
  forbiddenCardId: string;
}): {
  boardLeak: boolean;
  cardLeak: boolean;
} {
  const boardNeedle = forbiddenBoardId.toLowerCase();
  const cardNeedle = forbiddenCardId.toLowerCase();

  let boardLeak = false;
  let cardLeak = false;

  for (const row of results) {
    const id = normalizeText(row.id);
    const shortId = normalizeText(row.short_id);
    const boardId = normalizeText(row.board_id);
    const boardShortId = normalizeText(row.board_short_id);
    const title = normalizeText(row.title);

    if ([id, shortId, boardId, boardShortId, title].some((value) => value.includes(boardNeedle))) {
      boardLeak = true;
    }

    if ([id, shortId, boardId, boardShortId, title].some((value) => value.includes(cardNeedle))) {
      cardLeak = true;
    }
  }

  return { boardLeak, cardLeak };
}

function extractWorkspaceIdFromBoardPayload(payload: unknown): string | null {
  const data = (payload as { data?: Record<string, unknown> } | null)?.data;
  if (!data || typeof data !== 'object') return null;

  const snake = data.workspace_id;
  if (typeof snake === 'string' && snake.length > 0) return snake;

  const camel = data.workspaceId;
  if (typeof camel === 'string' && camel.length > 0) return camel;

  return null;
}

function deriveMarkerQuery({
  adminBoardBody,
  adminCardBody,
  forbiddenBoardId,
  forbiddenCardId,
}: {
  adminBoardBody: unknown;
  adminCardBody: unknown;
  forbiddenBoardId: string;
  forbiddenCardId: string;
}): string {
  const boardTitle = normalizeText((adminBoardBody as { data?: { title?: unknown } })?.data?.title)
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  const cardTitle = normalizeText((adminCardBody as { data?: { title?: unknown } })?.data?.title)
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  const boardWord = boardTitle.split(/\s+/).find((word) => word.length >= 4) ?? '';
  const cardWord = cardTitle.split(/\s+/).find((word) => word.length >= 4) ?? '';

  // Include short IDs so queries remain deterministic even if titles are generic.
  return [forbiddenBoardId, forbiddenCardId, boardWord, cardWord]
    .filter((value) => value && value.length > 0)
    .join(' ')
    .trim();
}

async function runAccountProbe({
  baseUrl,
  email,
  token,
  forbiddenBoardId,
  forbiddenCardId,
  workspaceId,
  markerQuery,
}: {
  baseUrl: string;
  email: string;
  token: string;
  forbiddenBoardId: string;
  forbiddenCardId: string;
  workspaceId: string;
  markerQuery: string;
}): Promise<AccountProbeSummary> {
  const baselineBoard = await apiGet({
    baseUrl,
    token,
    path: `/api/v1/boards/${forbiddenBoardId}`,
  });

  const baselineCard = await apiGet({
    baseUrl,
    token,
    path: `/api/v1/cards/${forbiddenCardId}`,
  });

  const workspaceSearch = await apiGet({
    baseUrl,
    token,
    path: `/api/v1/workspaces/${workspaceId}/search?query=${encodeURIComponent(markerQuery)}&limit=50`,
  });

  const boardSearch = await apiGet({
    baseUrl,
    token,
    path: `/api/v1/boards/${forbiddenBoardId}/search?query=${encodeURIComponent(markerQuery)}&limit=50`,
  });

  const workspaceResults = Array.isArray((workspaceSearch.body as SearchResponse | null)?.data)
    ? ((workspaceSearch.body as SearchResponse).data as Array<Record<string, unknown>>)
    : [];
  const boardResults = Array.isArray((boardSearch.body as SearchResponse | null)?.data)
    ? ((boardSearch.body as SearchResponse).data as Array<Record<string, unknown>>)
    : [];

  const workspaceLeaks = searchLeakInResults({
    results: workspaceResults,
    forbiddenBoardId,
    forbiddenCardId,
  });

  const boardLeaks = searchLeakInResults({
    results: boardResults,
    forbiddenBoardId,
    forbiddenCardId,
  });

  const vulnerable =
    (workspaceSearch.status >= 200 && workspaceSearch.status < 300 && (workspaceLeaks.boardLeak || workspaceLeaks.cardLeak)) ||
    (boardSearch.status >= 200 && boardSearch.status < 300 && (boardLeaks.boardLeak || boardLeaks.cardLeak));

  return {
    email,
    baseline: {
      boardReadStatus: baselineBoard.status,
      cardReadStatus: baselineCard.status,
    },
    search: {
      workspaceSearchStatus: workspaceSearch.status,
      boardSearchStatus: boardSearch.status,
      workspaceResultCount: workspaceResults.length,
      boardResultCount: boardResults.length,
      leakedForbiddenBoardInWorkspaceSearch: workspaceLeaks.boardLeak,
      leakedForbiddenCardInWorkspaceSearch: workspaceLeaks.cardLeak,
      leakedForbiddenBoardInBoardSearch: boardLeaks.boardLeak,
      leakedForbiddenCardInBoardSearch: boardLeaks.cardLeak,
    },
    vulnerable,
  };
}

function printUsage(): void {
  console.log(`
Search index cross-workspace data leak probe

Usage:
  bun run security/scripts/check-search-index-cross-workspace-data-leak.ts [options]

Options:
  --base-url <url>               API base URL (default: ${DEFAULT_BASE_URL})
  --normal-email <email>         Normal user email
  --normal-password <pwd>        Normal user password
  --pristine-email <email>       Pristine user email (no workspace access)
  --pristine-password <pwd>      Pristine user password
  --admin-email <email>          Admin user email
  --admin-password <pwd>         Admin user password
  --board-id <id>                Forbidden board short ID (default: ${DEFAULT_FORBIDDEN_BOARD_ID})
  --card-id <id>                 Forbidden card short ID (default: ${DEFAULT_FORBIDDEN_CARD_ID})
  --help                         Show this help
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
  console.log(`[audit] Pristine account: ${config.pristineEmail}`);
  console.log(`[audit] Admin account: ${config.adminEmail}`);
  console.log(`[audit] Forbidden board short ID: ${config.forbiddenBoardId}`);
  console.log(`[audit] Forbidden card short ID: ${config.forbiddenCardId}`);

  const [adminToken, normalToken, pristineToken] = await Promise.all([
    login({ baseUrl: config.baseUrl, email: config.adminEmail, password: config.adminPassword }),
    login({ baseUrl: config.baseUrl, email: config.normalEmail, password: config.normalPassword }),
    login({ baseUrl: config.baseUrl, email: config.pristineEmail, password: config.pristinePassword }),
  ]);

  const [adminBoard, adminCard] = await Promise.all([
    apiGet({ baseUrl: config.baseUrl, token: adminToken, path: `/api/v1/boards/${config.forbiddenBoardId}` }),
    apiGet({ baseUrl: config.baseUrl, token: adminToken, path: `/api/v1/cards/${config.forbiddenCardId}` }),
  ]);

  if (adminBoard.status < 200 || adminBoard.status >= 300) {
    throw new Error(`Admin cannot access target board (status ${adminBoard.status}).`);
  }

  if (adminCard.status < 200 || adminCard.status >= 300) {
    throw new Error(`Admin cannot access target card (status ${adminCard.status}).`);
  }

  const workspaceId = extractWorkspaceIdFromBoardPayload(adminBoard.body);
  if (!workspaceId) {
    throw new Error('Unable to resolve workspace ID from forbidden board payload.');
  }

  const markerQuery = deriveMarkerQuery({
    adminBoardBody: adminBoard.body,
    adminCardBody: adminCard.body,
    forbiddenBoardId: config.forbiddenBoardId,
    forbiddenCardId: config.forbiddenCardId,
  });

  const [normalProbe, pristineProbe] = await Promise.all([
    runAccountProbe({
      baseUrl: config.baseUrl,
      email: config.normalEmail,
      token: normalToken,
      forbiddenBoardId: config.forbiddenBoardId,
      forbiddenCardId: config.forbiddenCardId,
      workspaceId,
      markerQuery,
    }),
    runAccountProbe({
      baseUrl: config.baseUrl,
      email: config.pristineEmail,
      token: pristineToken,
      forbiddenBoardId: config.forbiddenBoardId,
      forbiddenCardId: config.forbiddenCardId,
      workspaceId,
      markerQuery,
    }),
  ]);

  const summary: ProbeSummary = {
    checkedAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    target: {
      forbiddenBoardId: config.forbiddenBoardId,
      forbiddenCardId: config.forbiddenCardId,
      workspaceId,
      markerQuery,
    },
    admin: {
      email: config.adminEmail,
      boardReadStatus: adminBoard.status,
      cardReadStatus: adminCard.status,
    },
    probes: {
      normal: normalProbe,
      pristine: pristineProbe,
    },
    vulnerable: normalProbe.vulnerable || pristineProbe.vulnerable,
  };

  console.log('\n=== Search Index Cross-Workspace Leak Probe Result ===');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.vulnerable) {
    console.error('\n[audit] Potential cross-workspace search data leak detected.');
    process.exit(2);
  }

  console.log('\n[audit] PASS: no cross-workspace search leak detected for tested accounts/resources.');
}

main().catch((error) => {
  console.error('[audit] Script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
