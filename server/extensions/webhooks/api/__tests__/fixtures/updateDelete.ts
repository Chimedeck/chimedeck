import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

const calls: unknown[] = [];
const state: {
  authError: Response | null;
  row: Record<string, unknown> | undefined;
  membershipError: Response | null;
  updates: unknown[];
  updatedRow: Record<string, unknown> | undefined;
  firstCallCount: number;
} = {
  authError: null,
  row: undefined,
  membershipError: null,
  updates: [],
  updatedRow: undefined,
  firstCallCount: 0,
};

void mock.module('../../../../../common/db', () => ({
  db(table: string) {
    calls.push(['db', table]);
    return {
      where(filter: Record<string, unknown>) {
        calls.push(['where', filter]);
        return this;
      },
      first() {
        calls.push('first');
        return Promise.resolve(state.firstCallCount++ === 0 ? state.row : (state.updatedRow ?? state.row));
      },
      select(...columns: string[]) {
        calls.push(['select', columns]);
        return this;
      },
      update(payload: Record<string, unknown>) {
        state.updates.push(payload);
        calls.push(['update', payload]);
        return Promise.resolve(1);
      },
      del() {
        calls.push('del');
        return Promise.resolve(1);
      },
    };
  },
}));

void mock.module('../../../../auth/middlewares/authentication', () => ({
  authenticate(req: Request) {
    calls.push(['authenticate', req]);
    return Promise.resolve(state.authError);
  },
}));

void mock.module('../../../../../middlewares/permissionManager', () => ({
  hasRole(callerRole: string, minRole: string) {
    const rank: Record<string, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };
    return (rank[callerRole] ?? 0) >= (rank[minRole] ?? 0);
  },
  requireWorkspaceMembership(req: { callerRole?: string }, workspaceId: string) {
    calls.push(['requireWorkspaceMembership', workspaceId]);
    if (state.membershipError) return Promise.resolve(state.membershipError);
    req.callerRole = 'MEMBER';
    return Promise.resolve(null);
  },
}));

void mock.module('../../ssrfGuard', () => ({
  isEndpointAllowed(url: string) {
    calls.push(['isEndpointAllowed', url]);
    return Promise.resolve(true);
  },
}));

const { handleUpdateWebhook } = await import('../../update');
const { handleDeleteWebhook } = await import('../../delete');

function authedReq(userId: string, body?: unknown): Request {
  const init: RequestInit = body
    ? { method: 'PATCH', body: JSON.stringify(body) }
    : { method: 'DELETE' };
  const req = new Request('http://localhost/api/v1/webhooks/hook-1', init);
  (req as unknown as { currentUser: { id: string } }).currentUser = { id: userId };
  return req;
}

// 1. Auth short-circuit.
state.authError = new Response('denied', { status: 401 });
assert.equal(await handleUpdateWebhook(authedReq('user-1'), 'hook-1'), state.authError);
assert.equal(await handleDeleteWebhook(authedReq('user-1'), 'hook-1'), state.authError);
state.authError = null;

// 2. Not found.
state.row = undefined;
const nf = await handleUpdateWebhook(authedReq('user-1'), 'hook-1');
assert.equal(nf.status, 404);
const nfd = await handleDeleteWebhook(authedReq('user-1'), 'hook-1');
assert.equal(nfd.status, 404);

// 3. Workspace-scoped webhook: membership check runs with the real workspace_id.
state.row = { id: 'hook-1', workspace_id: 'ws-1', created_by: 'owner-1' };
calls.length = 0;
await handleUpdateWebhook(authedReq('owner-1', { label: 'New' }), 'hook-1');
const membershipCall = calls.find(
  (c) => Array.isArray(c) && c[0] === 'requireWorkspaceMembership',
) as [string, string];
assert.deepEqual(membershipCall, ['requireWorkspaceMembership', 'ws-1']);

// 4. Global webhook (workspace_id: null since migration 0107) still calls
// requireWorkspaceMembership with null — preserving pre-typing runtime behaviour
// exactly, not skipping the call for global webhooks.
state.row = { id: 'hook-1', workspace_id: null, created_by: 'owner-1' };
calls.length = 0;
await handleDeleteWebhook(authedReq('owner-1'), 'hook-1');
const globalMembershipCall = calls.find(
  (c) => Array.isArray(c) && c[0] === 'requireWorkspaceMembership',
) as [string, string | null];
assert.deepEqual(globalMembershipCall, ['requireWorkspaceMembership', null]);

// 5. Membership failure propagates.
state.membershipError = new Response('forbidden', { status: 403 });
state.row = { id: 'hook-1', workspace_id: 'ws-1', created_by: 'owner-1' };
const membershipFail = await handleUpdateWebhook(authedReq('owner-1', { label: 'x' }), 'hook-1');
assert.equal(membershipFail, state.membershipError);
state.membershipError = null;

// 6. Non-owner, non-admin caller is rejected.
state.row = { id: 'hook-1', workspace_id: 'ws-1', created_by: 'owner-1' };
const forbidden = await handleDeleteWebhook(authedReq('intruder'), 'hook-1');
assert.equal(forbidden.status, 403);

// 7. Owner can update; response reflects the post-update projection read.
state.row = { id: 'hook-1', workspace_id: 'ws-1', created_by: 'owner-1' };
state.updatedRow = {
  id: 'hook-1',
  label: 'Updated Label',
  endpoint_url: 'https://example.com/hook',
  event_types: ['card.created'],
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};
state.firstCallCount = 0;
const updateOk = await handleUpdateWebhook(authedReq('owner-1', { label: 'Updated Label' }), 'hook-1');
assert.equal(updateOk.status, 200);
assert.deepEqual(await updateOk.json(), {
  data: {
    id: 'hook-1',
    label: 'Updated Label',
    endpointUrl: 'https://example.com/hook',
    eventTypes: ['card.created'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
});
state.updatedRow = undefined;

// 8. Owner can delete.
state.row = { id: 'hook-1', workspace_id: 'ws-1', created_by: 'owner-1' };
const deleteOk = await handleDeleteWebhook(authedReq('owner-1'), 'hook-1');
assert.equal(deleteOk.status, 200);
assert.deepEqual(await deleteOk.json(), { data: {} });

console.info(
  'webhook update/delete auth, workspace-scoped and global membership calls, ownership and success paths verified',
);
