import { mock } from 'bun:test';
import assert from 'node:assert/strict';

const scenario = process.argv[2];

const comment = { id: 'comment-a', card_id: 'card-a' };
const card = { id: 'card-a', list_id: 'list-a' };
const list = { id: 'list-a', board_id: 'board-a' };
const board = { id: 'board-a', workspace_id: 'workspace-a' };
const replies = [
  {
    id: 'reply-1', card_id: 'card-a', user_id: 'user-1', content: 'first', version: 1,
    deleted: false, parent_id: 'comment-a', created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z', author_name: 'Alice', author_email: 'alice@example.com',
    author_avatar_url: 's3://bucket/avatar-1',
  },
  {
    id: 'reply-2', card_id: 'card-a', user_id: 'user-2', content: 'second', version: 1,
    deleted: false, parent_id: 'comment-a', created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z', author_name: null, author_email: 'bob@example.com',
    author_avatar_url: null,
  },
];
const reactions = [
  { comment_id: 'reply-1', emoji: '👍', user_id: 'user-1' },
  { comment_id: 'reply-1', emoji: '👍', user_id: 'user-2' },
  { comment_id: 'reply-1', emoji: '🎉', user_id: 'user-3' },
];

const calls: unknown[] = [];
void mock.module('../../../../common/db', () => {
  const db = (table: string) => {
    calls.push(['table', table]);
    const query = {
      where: (...args: unknown[]) => { calls.push(['where', ...args]); return query; },
      leftJoin: (...args: unknown[]) => { calls.push(['leftJoin', ...args]); return query; },
      orderBy: (...args: unknown[]) => { calls.push(['orderBy', ...args]); return query; },
      whereIn: (...args: unknown[]) => { calls.push(['whereIn', ...args]); return query; },
      select: (...args: unknown[]) => {
        calls.push(['select', ...args]);
        return Promise.resolve(
          table === 'comment_reactions'
            ? (scenario === 'no-replies' ? [] : reactions)
            : replies,
        );
      },
      first: () => {
        calls.push(['first']);
        const rows: Record<string, unknown> = {
          comments: scenario === 'missing-comment' ? undefined : comment,
          cards: scenario === 'missing-board-chain' ? undefined : card,
          lists: list,
          boards: board,
        };
        return Promise.resolve(rows[table]);
      },
    };
    return query;
  };
  (db as unknown as { raw: (s: string) => string }).raw = (s: string) => s;
  return { db };
});
void mock.module('../../../auth/middlewares/authentication', () => ({
  authenticate: (req: Request) => {
    calls.push(['auth', req.url]);
    return Promise.resolve(scenario === 'unauthenticated' ? new Response('denied', { status: 401 }) : null);
  },
}));
void mock.module('../../../../middlewares/permissionManager', () => ({
  requireWorkspaceMembership: (_req: Request, workspaceId: string) => {
    calls.push(['membership', workspaceId]);
    return Promise.resolve(scenario === 'not-member' ? new Response('forbidden', { status: 403 }) : null);
  },
}));
void mock.module('../../../../common/avatar/resolveAvatarUrl', () => ({
  buildAvatarProxyUrl: ({ userId, avatarUrl }: { userId: string; avatarUrl: string | null }) => {
    calls.push(['avatarProxy', userId, avatarUrl]);
    return avatarUrl ? `/api/v1/users/${userId}/avatar` : null;
  },
}));

const { handleGetReplies } = await import('./get');
const req = new Request('http://127.0.0.1/api/v1/comments/comment-a/replies');
(req as unknown as { currentUser?: { id: string } }).currentUser = { id: 'user-1' };
const response = await handleGetReplies(req, 'comment-a');

if (scenario === 'unauthenticated') {
  assert.equal(response.status, 401);
  assert.deepEqual(calls, [['auth', req.url]]);
} else if (scenario === 'missing-comment') {
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: 'comment-not-found', message: 'Comment not found' } });
} else if (scenario === 'missing-board-chain') {
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: 'board-not-found', message: 'Board not found' } });
} else if (scenario === 'not-member') {
  assert.equal(response.status, 403);
} else if (scenario === 'no-replies') {
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: unknown[] };
  assert.equal(body.data.length, 2);
} else {
  assert.equal(scenario, 'ready');
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    data: { id: string; author_avatar_url: string | null; reactions: { emoji: string; count: number; reactedByMe: boolean }[] }[];
  };
  assert.equal(body.data.length, 2);
  const first = body.data[0];
  assert.ok(first);
  assert.equal(first.id, 'reply-1');
  assert.equal(first.author_avatar_url, '/api/v1/users/user-1/avatar');
  assert.deepEqual(first.reactions, [
    { emoji: '👍', count: 2, reactedByMe: true },
    { emoji: '🎉', count: 1, reactedByMe: false },
  ]);
  const second = body.data[1];
  assert.ok(second);
  assert.equal(second.id, 'reply-2');
  assert.equal(second.author_avatar_url, null);
  assert.deepEqual(second.reactions, []);
}

console.info('replies get: auth, board-chain guards, membership, reaction aggregation and avatar-proxy mapping verified');
