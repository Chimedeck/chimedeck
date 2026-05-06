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

type ProbeResult = {
  target: 'board' | 'card';
  id: string;
  status: number;
  ok: boolean;
  vulnerable: boolean;
  body: unknown;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_EMAIL = 'replace-test-email@email.com';
const DEFAULT_PASSWORD = '<replace-it-here>';
const DEFAULT_FORBIDDEN_BOARD_SHORT_ID = '7WlfAtA7';
const DEFAULT_FORBIDDEN_CARD_SHORT_ID = 'QqOnIdEz';

function getCliArg(name: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function getConfig() {
  const baseUrl = getCliArg('base-url') ?? Bun.env['AUDIT_BASE_URL'] ?? DEFAULT_BASE_URL;
  const email = getCliArg('email') ?? Bun.env['AUDIT_EMAIL'] ?? DEFAULT_EMAIL;
  const password = getCliArg('password') ?? Bun.env['AUDIT_PASSWORD'] ?? DEFAULT_PASSWORD;
  const boardShortId = getCliArg('board-id') ?? Bun.env['AUDIT_FORBIDDEN_BOARD_ID'] ?? DEFAULT_FORBIDDEN_BOARD_SHORT_ID;
  const cardShortId = getCliArg('card-id') ?? Bun.env['AUDIT_FORBIDDEN_CARD_ID'] ?? DEFAULT_FORBIDDEN_CARD_SHORT_ID;

  return { baseUrl, email, password, boardShortId, cardShortId };
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
}): Promise<{ accessToken: string; payload: unknown }> {
  const response = await fetch(`${baseUrl}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}: ${JSON.stringify(payload)}`);
  }

  const accessToken = (payload as LoginSuccess)?.data?.accessToken;
  if (!accessToken) {
    throw new Error(`Login succeeded but no access token was returned: ${JSON.stringify(payload)}`);
  }

  return { accessToken, payload };
}

async function probe({
  baseUrl,
  token,
  target,
  id,
}: {
  baseUrl: string;
  token: string;
  target: 'board' | 'card';
  id: string;
}): Promise<ProbeResult> {
  const path = target === 'board' ? `/api/v1/boards/${id}` : `/api/v1/cards/${id}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await parseJsonSafe(response);

  // For this specific audit, any 2xx response indicates unauthorized access succeeded.
  const vulnerable = response.status >= 200 && response.status < 300;

  return {
    target,
    id,
    status: response.status,
    ok: response.ok,
    vulnerable,
    body,
  };
}

function printUsage(): void {
  console.log(`
Cross-tenant board/card IDOR probe

Usage:
  bun run security/scripts/check-cross-tenant-board-card-idor.ts [options]

Options:
  --base-url <url>   API base URL (default: ${DEFAULT_BASE_URL})
  --email <email>    Login email (default: provided normal account)
  --password <pwd>   Login password (default: provided normal account)
  --board-id <id>    Forbidden board short ID (default: ${DEFAULT_FORBIDDEN_BOARD_SHORT_ID})
  --card-id <id>     Forbidden card short ID (default: ${DEFAULT_FORBIDDEN_CARD_SHORT_ID})
  --help             Show this help

Environment variable alternatives:
  AUDIT_BASE_URL, AUDIT_EMAIL, AUDIT_PASSWORD, AUDIT_FORBIDDEN_BOARD_ID, AUDIT_FORBIDDEN_CARD_ID
`);
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const { baseUrl, email, password, boardShortId, cardShortId } = getConfig();

  console.log(`[audit] Base URL: ${baseUrl}`);
  console.log(`[audit] Login account: ${email}`);
  console.log(`[audit] Forbidden board short ID: ${boardShortId}`);
  console.log(`[audit] Forbidden card short ID: ${cardShortId}`);

  const { accessToken } = await login({ baseUrl, email, password });
  console.log('[audit] Login successful. Running probes...');

  const boardProbe = await probe({
    baseUrl,
    token: accessToken,
    target: 'board',
    id: boardShortId,
  });

  const cardProbe = await probe({
    baseUrl,
    token: accessToken,
    target: 'card',
    id: cardShortId,
  });

  const summary = {
    loginAccount: email,
    checkedAt: new Date().toISOString(),
    results: [boardProbe, cardProbe],
    vulnerable: boardProbe.vulnerable || cardProbe.vulnerable,
  };

  console.log('\n=== IDOR Probe Result ===');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.vulnerable) {
    console.error('\n[audit] Potential IDOR detected: at least one forbidden resource returned 2xx.');
    process.exit(2);
  }

  console.log('\n[audit] PASS: forbidden resources were not accessible with this account.');
}

main().catch((error) => {
  console.error('[audit] Script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
