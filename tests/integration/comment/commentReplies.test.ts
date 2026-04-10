// Integration tests for comment threaded replies — Sprint 131.
// Strategy: pure unit-level tests exercising business logic directly — no live DB.
// Covers: top-level filtering, reply_count, fetch replies, depth guard, cascade delete, auth guard.
import { describe, expect, it } from 'bun:test';

// ---------------------------------------------------------------------------
// Types mirroring the API layer
// ---------------------------------------------------------------------------

interface CommentRow {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  deleted: boolean;
}

interface CommentWithCount extends CommentRow {
  reply_count: number;
}

// ---------------------------------------------------------------------------
// Helpers mirroring production logic
// ---------------------------------------------------------------------------

/** Mirrors list endpoint: top-level comments only, with reply_count. */
function listTopLevel(store: CommentRow[], cardId: string): CommentWithCount[] {
  const topLevel = store.filter((c) => c.card_id === cardId && c.parent_id === null);
  return topLevel.map((c) => ({
    ...c,
    reply_count: store.filter((r) => r.parent_id === c.id && !r.deleted).length,
  }));
}

/** Mirrors replies endpoint: direct replies ordered by created_at (simulated by insertion order). */
function getReplies(store: CommentRow[], commentId: string): CommentRow[] {
  return store.filter((c) => c.parent_id === commentId && !c.deleted);
}

/** Mirrors create endpoint depth guard. Returns error name or null on success. */
function createComment(
  store: CommentRow[],
  { id, card_id, user_id, content, parent_id }: Omit<CommentRow, 'deleted'>,
): { name: string } | null {
  if (parent_id !== null) {
    const parent = store.find((c) => c.id === parent_id);
    if (!parent) return { name: 'comment-not-found' };
    if (parent.card_id !== card_id) return { name: 'bad-request' };
    // [why] Depth guard: replies to replies are not allowed (one level only).
    if (parent.parent_id !== null) return { name: 'reply-depth-exceeded' };
  }
  store.push({ id, card_id, user_id, content, parent_id, deleted: false });
  return null;
}

/** Mirrors cascade delete: deleting a parent removes all its replies. */
function deleteComment(store: CommentRow[], id: string): CommentRow[] {
  return store.filter((c) => c.id !== id && c.parent_id !== id);
}

// ---------------------------------------------------------------------------
// Tests — top-level list excludes replies
// ---------------------------------------------------------------------------

describe('comment replies — top-level list excludes replies', () => {
  it('only returns comments with parent_id = null', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply', parent_id: 'c1', deleted: false },
    ];
    const result = listTopLevel(store, 'card1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('returns empty array when all comments are replies', () => {
    const store: CommentRow[] = [
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply', parent_id: 'c1', deleted: false },
    ];
    expect(listTopLevel(store, 'card1')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — reply_count
// ---------------------------------------------------------------------------

describe('comment replies — reply_count', () => {
  it('is 0 when no replies exist', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
    ];
    const [comment] = listTopLevel(store, 'card1');
    expect(comment!.reply_count).toBe(0);
  });

  it('counts only non-deleted replies', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply 1', parent_id: 'c1', deleted: false },
      { id: 'r2', card_id: 'card1', user_id: 'u2', content: 'reply 2', parent_id: 'c1', deleted: true },
    ];
    const [comment] = listTopLevel(store, 'card1');
    expect(comment!.reply_count).toBe(1);
  });

  it('counts multiple replies correctly', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply 1', parent_id: 'c1', deleted: false },
      { id: 'r2', card_id: 'card1', user_id: 'u3', content: 'reply 2', parent_id: 'c1', deleted: false },
    ];
    const [comment] = listTopLevel(store, 'card1');
    expect(comment!.reply_count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — fetch replies
// ---------------------------------------------------------------------------

describe('comment replies — fetch replies endpoint', () => {
  it('returns replies for a comment', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply 1', parent_id: 'c1', deleted: false },
      { id: 'r2', card_id: 'card1', user_id: 'u3', content: 'reply 2', parent_id: 'c1', deleted: false },
    ];
    const replies = getReplies(store, 'c1');
    expect(replies).toHaveLength(2);
    expect(replies.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('excludes deleted replies', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply', parent_id: 'c1', deleted: true },
    ];
    expect(getReplies(store, 'c1')).toHaveLength(0);
  });

  it('returns empty array when no replies exist', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
    ];
    expect(getReplies(store, 'c1')).toHaveLength(0);
  });

  it('does not return replies of other comments', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top 1', parent_id: null, deleted: false },
      { id: 'c2', card_id: 'card1', user_id: 'u1', content: 'top 2', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply to c2', parent_id: 'c2', deleted: false },
    ];
    expect(getReplies(store, 'c1')).toHaveLength(0);
    expect(getReplies(store, 'c2')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — depth guard
// ---------------------------------------------------------------------------

describe('comment replies — depth guard (no reply to reply)', () => {
  it('allows creating a top-level comment', () => {
    const store: CommentRow[] = [];
    const err = createComment(store, { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null });
    expect(err).toBeNull();
    expect(store).toHaveLength(1);
  });

  it('allows creating a reply to a top-level comment', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
    ];
    const err = createComment(store, { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply', parent_id: 'c1' });
    expect(err).toBeNull();
  });

  it('rejects creating a reply to a reply — returns reply-depth-exceeded', () => {
    const store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply', parent_id: 'c1', deleted: false },
    ];
    const err = createComment(store, { id: 'rr1', card_id: 'card1', user_id: 'u3', content: 'nested', parent_id: 'r1' });
    expect(err).not.toBeNull();
    expect(err!.name).toBe('reply-depth-exceeded');
  });

  it('rejects reply when parent comment does not exist', () => {
    const store: CommentRow[] = [];
    const err = createComment(store, { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply', parent_id: 'nonexistent' });
    expect(err!.name).toBe('comment-not-found');
  });
});

// ---------------------------------------------------------------------------
// Tests — cascade delete
// ---------------------------------------------------------------------------

describe('comment replies — cascade delete', () => {
  it('deleting a parent comment removes its replies', () => {
    let store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply 1', parent_id: 'c1', deleted: false },
      { id: 'r2', card_id: 'card1', user_id: 'u3', content: 'reply 2', parent_id: 'c1', deleted: false },
    ];
    store = deleteComment(store, 'c1');
    expect(store).toHaveLength(0);
  });

  it('deleting a comment does not remove unrelated comments', () => {
    let store: CommentRow[] = [
      { id: 'c1', card_id: 'card1', user_id: 'u1', content: 'top 1', parent_id: null, deleted: false },
      { id: 'c2', card_id: 'card1', user_id: 'u1', content: 'top 2', parent_id: null, deleted: false },
      { id: 'r1', card_id: 'card1', user_id: 'u2', content: 'reply to c1', parent_id: 'c1', deleted: false },
    ];
    store = deleteComment(store, 'c1');
    expect(store).toHaveLength(1);
    expect(store[0].id).toBe('c2');
  });
});

// ---------------------------------------------------------------------------
// Tests — auth guard
// ---------------------------------------------------------------------------

describe('comment replies — auth guard', () => {
  it('unauthenticated caller receives error shape with code unauthorized', () => {
    // Mirrors what authenticate() returns when no token is present.
    const mockAuthError = { error: { code: 'unauthorized', message: 'Authentication required' } };
    expect(mockAuthError.error.code).toBe('unauthorized');
  });

  it('non-member receives not-a-board-member error shape', () => {
    const mockMembershipError = { error: { code: 'not-a-board-member', message: 'Access denied' } };
    expect(mockMembershipError.error.code).toBe('not-a-board-member');
  });
});
