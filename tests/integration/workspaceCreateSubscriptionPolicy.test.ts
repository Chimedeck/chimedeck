import { describe, expect, it, mock } from 'bun:test';

const transactionMock = mock(async () => {
  throw new Error('transaction-should-not-run-when-blocked');
});

const dbCallMock = mock(() => ({
  leftJoin: () => ({
    where: () => ({
      select: async () => [{ workspaceId: 'ws-free', tier: 'tier_1' }],
    }),
  }),
}));

const dbMock = Object.assign(dbCallMock, {
  transaction: transactionMock,
});

mock.module('../../server/common/db', () => ({
  db: dbMock,
}));

mock.module('../../server/config/env', () => ({
  env: {
    SUBSCRIPTIONS_ENABLED: true,
  },
}));

mock.module('../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: async (req: Request & { currentUser?: { id: string } }) => {
    req.currentUser = { id: 'user-1' };
    return null;
  },
}));

const { workspaceRouter } = await import('../../server/extensions/workspace/api');

describe('POST /api/v1/workspaces subscription policy', () => {
  it('returns 402 with blocking workspace payload when owner already has a free workspace', async () => {
    const req = new Request('http://localhost/api/v1/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Another Workspace' }),
    });

    const res = await workspaceRouter(req, '/api/v1/workspaces');
    const body = await res!.json() as {
      error?: {
        code?: string;
        message?: string;
        data?: { workspaceId?: string; upgradeUrl?: string };
      };
    };

    expect(res?.status).toBe(402);
    expect(body.error?.code).toBe('workspace-creation-limit-reached');
    expect(body.error?.message).toBe('You have reached the workspace limit for your current plan.');
    expect(body.error?.data?.workspaceId).toBe('ws-free');
    expect(body.error?.data?.upgradeUrl).toBe('/workspace/ws-free/billing');
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
