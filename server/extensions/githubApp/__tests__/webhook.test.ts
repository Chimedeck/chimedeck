// Tests for the POST /api/v1/github/webhook route handler.
//
// Covers the full request pipeline: env gate, raw-body capture, signature
// verification (per-installation secret + env fallback), and event dispatch.
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createHmac } from 'node:crypto';

// Mutable env state — the mock module exposes these through getters so
// each test can override the bits it cares about.
const envState: Record<string, string> = {
  GITHUB_WEBHOOKS_ENABLED: 'true',
  GITHUB_APP_WEBHOOK_SECRET: 'test-fallback-secret',
  WEBHOOK_SECRET_ENCRYPTION_KEY: '0'.repeat(64),
};

mock.module('../../../config/env', () => ({
  env: {
    get GITHUB_WEBHOOKS_ENABLED() {
      return envState.GITHUB_WEBHOOKS_ENABLED === 'true';
    },
    get GITHUB_APP_WEBHOOK_SECRET() {
      return envState.GITHUB_APP_WEBHOOK_SECRET ?? '';
    },
    get WEBHOOK_SECRET_ENCRYPTION_KEY() {
      return envState.WEBHOOK_SECRET_ENCRYPTION_KEY ?? '';
    },
  },
}));

// In-memory mock of the github_app_installations table.
type InstallationRow = {
  installation_id: string;
  account_login: string;
  account_type: string;
  repositories: string;
  suspended: boolean;
  webhook_secret_encrypted: string | null;
};
const installationRows = new Map<string, InstallationRow>();

mock.module('../../../common/db', () => {
  const from = (table: string) => {
    if (table !== 'github_app_installations') {
      throw new Error(`Unexpected table access in test: ${table}`);
    }
    const state: { filters: Array<(row: InstallationRow) => boolean> } = { filters: [] };
    const query = {
      where(criteria: Partial<InstallationRow>) {
        state.filters.push((row) =>
          Object.entries(criteria).every(([k, v]) => (row as Record<string, unknown>)[k] === v)
        );
        return query;
      },
      select() {
        return query;
      },
      update: async (updates: Record<string, unknown>) => {
        for (const [id, row] of installationRows) {
          if (state.filters.every((f) => f(row))) {
            Object.assign(row, updates, { updated_at: new Date().toISOString() });
            installationRows.set(id, row);
          }
        }
        return installationRows.size;
      },
      first: async () => {
        for (const row of installationRows.values()) {
          if (state.filters.every((f) => f(row))) return { ...row };
        }
        return undefined;
      },
      insert: async (row: InstallationRow) => {
        installationRows.set(row.installation_id, row);
        return [row];
      },
      delete: async () => {
        let count = 0;
        for (const [id, row] of installationRows) {
          if (state.filters.every((f) => f(row))) {
            installationRows.delete(id);
            count++;
          }
        }
        return count;
      },
      then<TResult1 = InstallationRow[], TResult2 = never>(
        onfulfilled?: ((value: InstallationRow[]) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ): Promise<TResult1 | TResult2> {
        const results: InstallationRow[] = [];
        for (const row of installationRows.values()) {
          if (state.filters.every((f) => f(row))) results.push({ ...row });
        }
        return Promise.resolve(results).then(onfulfilled, onrejected);
      },
    };
    return query;
  };
  return { db: from };
});

const { handleGitHubWebhook } = await import('../api/webhook');

function makeSignedRequest({
  body,
  secret,
  event = 'installation',
  signatureOverride,
}: {
  body: string;
  secret: string;
  event?: string;
  signatureOverride?: string;
}): Request {
  const signature =
    signatureOverride ??
    `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
  return new Request('https://example.com/api/v1/github/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
      'x-github-event': event,
    },
    body,
  });
}

beforeEach(() => {
  installationRows.clear();
  envState.GITHUB_WEBHOOKS_ENABLED = 'true';
  envState.GITHUB_APP_WEBHOOK_SECRET = 'test-fallback-secret';
  envState.WEBHOOK_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
});

describe('handleGitHubWebhook', () => {
  it('returns 501 when GITHUB_WEBHOOKS_ENABLED=false', async () => {
    envState.GITHUB_WEBHOOKS_ENABLED = 'false';
    const req = makeSignedRequest({ body: '{}', secret: 'test-fallback-secret' });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(501);
  });

  it('returns 405 for non-POST methods', async () => {
    const req = new Request('https://example.com/api/v1/github/webhook', { method: 'GET' });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(405);
  });

  it('returns 400 for empty body', async () => {
    const req = new Request('https://example.com/api/v1/github/webhook', {
      method: 'POST',
      body: '',
    });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('https://example.com/api/v1/github/webhook', {
      method: 'POST',
      body: 'not json',
    });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when the signature is missing', async () => {
    const req = new Request('https://example.com/api/v1/github/webhook', {
      method: 'POST',
      headers: { 'x-github-event': 'installation' },
      body: '{}',
    });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the signature does not match the env fallback', async () => {
    const body =
      '{"action":"created","installation":{"id":1,"account":{"login":"acme","type":"Organization"}}}';
    const req = makeSignedRequest({ body, secret: 'wrong-secret' });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(401);
  });

  it('accepts a valid signature against the env fallback and creates the installation row', async () => {
    const body = JSON.stringify({
      action: 'created',
      installation: {
        id: 1,
        account: { login: 'acme', type: 'Organization' },
        repositories: [{ id: 100, full_name: 'acme/repo', private: false, default_branch: 'main' }],
      },
    });
    const req = makeSignedRequest({ body, secret: 'test-fallback-secret' });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(202);

    const stored = installationRows.get('1');
    expect(stored).toBeDefined();
    expect(stored?.account_login).toBe('acme');
    expect(stored?.account_type).toBe('Organization');
    expect(stored?.webhook_secret_encrypted).not.toBeNull();
  });

  it('uses a previously-stored per-installation secret for verification', async () => {
    // Pre-populate an installation with an encrypted secret derived from
    // a different key than the env fallback, to prove we use the per-install
    // secret (not the env fallback) on subsequent deliveries.
    const { encryptSecret } = await import('../../../common/crypto');
    const perInstallSecret = 'per-install-secret';
    const hexKey = envState.WEBHOOK_SECRET_ENCRYPTION_KEY as string;
    const encrypted = encryptSecret({
      plaintext: perInstallSecret,
      hexKey,
    });
    installationRows.set('7', {
      installation_id: '7',
      account_login: 'acme',
      account_type: 'Organization',
      repositories: '[]',
      suspended: false,
      webhook_secret_encrypted: encrypted,
    });

    const body = JSON.stringify({
      action: 'created',
      installation: { id: 7, account: { login: 'acme', type: 'Organization' } },
    });
    // Signed with the per-install secret — would NOT verify against the env fallback.
    const req = makeSignedRequest({ body, secret: perInstallSecret });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(202);
  });

  it('handles installation_repositories by upserting the merged repo list', async () => {
    // Seed with two existing repos.
    installationRows.set('9', {
      installation_id: '9',
      account_login: 'acme',
      account_type: 'Organization',
      repositories: JSON.stringify([
        { id: 100, full_name: 'acme/keep', private: false, default_branch: 'main' },
        { id: 101, full_name: 'acme/drop', private: false, default_branch: 'main' },
      ]),
      suspended: false,
      webhook_secret_encrypted: null,
    });

    const body = JSON.stringify({
      action: 'added',
      installation: { id: 9, account: { login: 'acme', type: 'Organization' } },
      repositories_added: [
        { id: 102, full_name: 'acme/added', private: false, default_branch: 'main' },
      ],
      repositories_removed: [
        { id: 101, full_name: 'acme/drop', private: false, default_branch: 'main' },
      ],
    });
    const req = makeSignedRequest({
      body,
      secret: 'test-fallback-secret',
      event: 'installation_repositories',
    });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(202);

    const repos = JSON.parse(installationRows.get('9')?.repositories ?? '[]') as Array<{
      id: number;
      full_name: string;
    }>;
    const names = repos.map((r) => r.full_name).sort();
    expect(names).toEqual(['acme/added', 'acme/keep']);
  });

  it('handles installation.deleted by removing the row', async () => {
    installationRows.set('11', {
      installation_id: '11',
      account_login: 'acme',
      account_type: 'Organization',
      repositories: '[]',
      suspended: false,
      webhook_secret_encrypted: null,
    });
    const body = JSON.stringify({
      action: 'deleted',
      installation: { id: 11, account: { login: 'acme', type: 'Organization' } },
    });
    const req = makeSignedRequest({ body, secret: 'test-fallback-secret' });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(202);
    expect(installationRows.has('11')).toBe(false);
  });

  it('accepts unknown event types with 202 and does not write to the DB', async () => {
    const body = JSON.stringify({ installation: { id: 1 } });
    const req = makeSignedRequest({ body, secret: 'test-fallback-secret', event: 'ping' });
    const res = await handleGitHubWebhook(req);
    expect(res.status).toBe(202);
    expect(installationRows.has('1')).toBe(false);
  });
});
