#!/usr/bin/env bun

type LoginResponse = {
  data?: {
    accessToken?: string;
  };
};

type AccountProbe = {
  email: string;
  baseline: {
    boardReadStatus: number;
    cardReadStatus: number;
  };
  listEndpoints: {
    commentsStatus: number;
    commentsCount: number;
    attachmentsStatus: number;
    attachmentsCount: number;
  };
  directIdProbes: {
    commentRepliesExistingStatus: number | null;
    commentRepliesRandomStatus: number | null;
    commentRepliesDistinguishable: boolean;
    attachmentViewExistingStatus: number | null;
    attachmentViewRandomStatus: number | null;
    attachmentViewDistinguishable: boolean;
  };
  vulnerable: boolean;
};

type Summary = {
  checkedAt: string;
  baseUrl: string;
  target: {
    forbiddenBoardId: string;
    forbiddenCardId: string;
    sampleCommentId: string | null;
    sampleAttachmentId: string | null;
  };
  adminControl: {
    boardReadStatus: number;
    cardReadStatus: number;
    commentListStatus: number;
    commentCount: number;
    attachmentListStatus: number;
    attachmentCount: number;
  };
  probes: {
    normal: AccountProbe;
    pristine: AccountProbe;
  };
  vulnerable: boolean;
};

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_NORMAL_EMAIL = 'replace-test-email@email.com';
const DEFAULT_NORMAL_PASSWORD = 'replace-password-here';
const DEFAULT_PRISTINE_EMAIL = 'replace-test-email+test@email.com';
const DEFAULT_PRISTINE_PASSWORD = 'replace-password-here';
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

  return { status: response.status, body: await parseJsonSafe(response) };
}

function randomUuid(): string {
  return crypto.randomUUID();
}

function arrayData(body: unknown): Array<Record<string, unknown>> {
  const data = (body as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
}

async function runAccountProbe({
  baseUrl,
  token,
  email,
  forbiddenBoardId,
  forbiddenCardId,
  sampleCommentId,
  sampleAttachmentId,
}: {
  baseUrl: string;
  token: string;
  email: string;
  forbiddenBoardId: string;
  forbiddenCardId: string;
  sampleCommentId: string | null;
  sampleAttachmentId: string | null;
}): Promise<AccountProbe> {
  const [boardRead, cardRead, commentsList, attachmentsList] = await Promise.all([
    apiGet({ baseUrl, token, path: `/api/v1/boards/${forbiddenBoardId}` }),
    apiGet({ baseUrl, token, path: `/api/v1/cards/${forbiddenCardId}` }),
    apiGet({ baseUrl, token, path: `/api/v1/cards/${forbiddenCardId}/comments` }),
    apiGet({ baseUrl, token, path: `/api/v1/cards/${forbiddenCardId}/attachments` }),
  ]);

  const comments = arrayData(commentsList.body);
  const attachments = arrayData(attachmentsList.body);

  let commentRepliesExistingStatus: number | null = null;
  let commentRepliesRandomStatus: number | null = null;
  let commentRepliesDistinguishable = false;

  if (sampleCommentId) {
    const [existingRes, randomRes] = await Promise.all([
      apiGet({ baseUrl, token, path: `/api/v1/comments/${sampleCommentId}/replies` }),
      apiGet({ baseUrl, token, path: `/api/v1/comments/${randomUuid()}/replies` }),
    ]);
    commentRepliesExistingStatus = existingRes.status;
    commentRepliesRandomStatus = randomRes.status;
    commentRepliesDistinguishable = existingRes.status !== randomRes.status;
  }

  let attachmentViewExistingStatus: number | null = null;
  let attachmentViewRandomStatus: number | null = null;
  let attachmentViewDistinguishable = false;

  if (sampleAttachmentId) {
    const [existingRes, randomRes] = await Promise.all([
      apiGet({ baseUrl, token, path: `/api/v1/attachments/${sampleAttachmentId}/view` }),
      apiGet({ baseUrl, token, path: `/api/v1/attachments/${randomUuid()}/view` }),
    ]);
    attachmentViewExistingStatus = existingRes.status;
    attachmentViewRandomStatus = randomRes.status;
    attachmentViewDistinguishable = existingRes.status !== randomRes.status;
  }

  const directDataLeak =
    (commentsList.status >= 200 && commentsList.status < 300 && comments.length > 0) ||
    (attachmentsList.status >= 200 && attachmentsList.status < 300 && attachments.length > 0);

  const enumerationSideChannel = commentRepliesDistinguishable || attachmentViewDistinguishable;

  return {
    email,
    baseline: {
      boardReadStatus: boardRead.status,
      cardReadStatus: cardRead.status,
    },
    listEndpoints: {
      commentsStatus: commentsList.status,
      commentsCount: comments.length,
      attachmentsStatus: attachmentsList.status,
      attachmentsCount: attachments.length,
    },
    directIdProbes: {
      commentRepliesExistingStatus,
      commentRepliesRandomStatus,
      commentRepliesDistinguishable,
      attachmentViewExistingStatus,
      attachmentViewRandomStatus,
      attachmentViewDistinguishable,
    },
    vulnerable: directDataLeak || enumerationSideChannel,
  };
}

function printUsage(): void {
  console.log(`
Cross-tenant comment and attachment enumeration probe

Usage:
  bun run security/scripts/check-cross-tenant-comment-attachment-enumeration.ts [options]

Options:
  --base-url <url>               API base URL (default: ${DEFAULT_BASE_URL})
  --normal-email <email>         Normal user email
  --normal-password <pwd>        Normal user password
  --pristine-email <email>       Pristine user email
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

  const [adminBoardRead, adminCardRead, adminCommentsList, adminAttachmentsList] = await Promise.all([
    apiGet({ baseUrl: config.baseUrl, token: adminToken, path: `/api/v1/boards/${config.forbiddenBoardId}` }),
    apiGet({ baseUrl: config.baseUrl, token: adminToken, path: `/api/v1/cards/${config.forbiddenCardId}` }),
    apiGet({ baseUrl: config.baseUrl, token: adminToken, path: `/api/v1/cards/${config.forbiddenCardId}/comments` }),
    apiGet({ baseUrl: config.baseUrl, token: adminToken, path: `/api/v1/cards/${config.forbiddenCardId}/attachments` }),
  ]);

  if (adminBoardRead.status < 200 || adminBoardRead.status >= 300) {
    throw new Error(`Admin cannot access forbidden board control target (status ${adminBoardRead.status}).`);
  }
  if (adminCardRead.status < 200 || adminCardRead.status >= 300) {
    throw new Error(`Admin cannot access forbidden card control target (status ${adminCardRead.status}).`);
  }

  const adminComments = arrayData(adminCommentsList.body);
  const adminAttachments = arrayData(adminAttachmentsList.body);
  const sampleCommentId = typeof adminComments[0]?.id === 'string' ? (adminComments[0].id as string) : null;
  const sampleAttachmentId = typeof adminAttachments[0]?.id === 'string' ? (adminAttachments[0].id as string) : null;

  const [normalProbe, pristineProbe] = await Promise.all([
    runAccountProbe({
      baseUrl: config.baseUrl,
      token: normalToken,
      email: config.normalEmail,
      forbiddenBoardId: config.forbiddenBoardId,
      forbiddenCardId: config.forbiddenCardId,
      sampleCommentId,
      sampleAttachmentId,
    }),
    runAccountProbe({
      baseUrl: config.baseUrl,
      token: pristineToken,
      email: config.pristineEmail,
      forbiddenBoardId: config.forbiddenBoardId,
      forbiddenCardId: config.forbiddenCardId,
      sampleCommentId,
      sampleAttachmentId,
    }),
  ]);

  const summary: Summary = {
    checkedAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    target: {
      forbiddenBoardId: config.forbiddenBoardId,
      forbiddenCardId: config.forbiddenCardId,
      sampleCommentId,
      sampleAttachmentId,
    },
    adminControl: {
      boardReadStatus: adminBoardRead.status,
      cardReadStatus: adminCardRead.status,
      commentListStatus: adminCommentsList.status,
      commentCount: adminComments.length,
      attachmentListStatus: adminAttachmentsList.status,
      attachmentCount: adminAttachments.length,
    },
    probes: {
      normal: normalProbe,
      pristine: pristineProbe,
    },
    vulnerable: normalProbe.vulnerable || pristineProbe.vulnerable,
  };

  console.log('\n=== Cross-Tenant Comment & Attachment Enumeration Probe Result ===');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.vulnerable) {
    console.error('\n[audit] Potential cross-tenant comment/attachment enumeration issue detected.');
    process.exit(2);
  }

  console.log('\n[audit] PASS: no cross-tenant comment/attachment leak or enumeration side-channel detected for tested accounts.');
}

main().catch((error) => {
  console.error('[audit] Script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
