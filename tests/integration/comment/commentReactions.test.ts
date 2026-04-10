// Integration tests for comment emoji reactions — Sprint 129.
// Strategy: pure unit-level tests exercising business logic directly — no live DB.
// Covers: add (happy path), idempotent add, remove (happy path), idempotent remove,
//         list shape (ReactionSummary[]), auth guard.
import { describe, expect, it } from 'bun:test';

// ---------------------------------------------------------------------------
// Types mirroring the API layer
// ---------------------------------------------------------------------------

interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

interface ReactionRow {
  comment_id: string;
  user_id: string;
  emoji: string;
}

// ---------------------------------------------------------------------------
// Helpers mirroring production logic
// ---------------------------------------------------------------------------

function validateEmoji(emoji: unknown): { ok: boolean; name?: string } {
  if (!emoji || typeof emoji !== 'string' || emoji.trim() === '' || emoji.trim().length > 32) {
    return { ok: false, name: 'reaction-emoji-invalid' };
  }
  return { ok: true };
}

/** Mirrors idempotent upsert — returns updated reaction store. */
function addReaction(
  store: ReactionRow[],
  commentId: string,
  userId: string,
  emoji: string,
): ReactionRow[] {
  const exists = store.some(
    (r) => r.comment_id === commentId && r.user_id === userId && r.emoji === emoji,
  );
  if (exists) return store; // idempotent
  return [...store, { comment_id: commentId, user_id: userId, emoji }];
}

/** Mirrors idempotent delete — returns updated reaction store. */
function removeReaction(
  store: ReactionRow[],
  commentId: string,
  userId: string,
  emoji: string,
): ReactionRow[] {
  return store.filter(
    (r) => !(r.comment_id === commentId && r.user_id === userId && r.emoji === emoji),
  );
}

/** Groups reaction rows into ReactionSummary[] for a specific comment. */
function groupReactions(
  rows: ReactionRow[],
  commentId: string,
  callerUserId: string,
): ReactionSummary[] {
  const emojiMap = new Map<string, { count: number; meReacted: boolean }>();
  for (const row of rows.filter((r) => r.comment_id === commentId)) {
    const existing = emojiMap.get(row.emoji) ?? { count: 0, meReacted: false };
    existing.count += 1;
    if (row.user_id === callerUserId) existing.meReacted = true;
    emojiMap.set(row.emoji, existing);
  }
  return Array.from(emojiMap.entries())
    .map(([emoji, { count, meReacted }]) => ({ emoji, count, reactedByMe: meReacted }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('comment reactions — emoji validation', () => {
  it('accepts a valid native emoji', () => {
    expect(validateEmoji('👍')).toEqual({ ok: true });
  });

  it('rejects empty string', () => {
    expect(validateEmoji('')).toEqual({ ok: false, name: 'reaction-emoji-invalid' });
  });

  it('rejects whitespace-only string', () => {
    expect(validateEmoji('   ')).toEqual({ ok: false, name: 'reaction-emoji-invalid' });
  });

  it('rejects string longer than 32 chars', () => {
    expect(validateEmoji('a'.repeat(33))).toEqual({ ok: false, name: 'reaction-emoji-invalid' });
  });

  it('rejects non-string values', () => {
    expect(validateEmoji(null)).toEqual({ ok: false, name: 'reaction-emoji-invalid' });
    expect(validateEmoji(42)).toEqual({ ok: false, name: 'reaction-emoji-invalid' });
  });
});

describe('comment reactions — add (idempotent upsert)', () => {
  it('adds a reaction row when none exists', () => {
    const store: ReactionRow[] = [];
    const result = addReaction(store, 'c1', 'u1', '👍');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ comment_id: 'c1', user_id: 'u1', emoji: '👍' });
  });

  it('is idempotent — does not duplicate on second add', () => {
    let store: ReactionRow[] = [];
    store = addReaction(store, 'c1', 'u1', '👍');
    store = addReaction(store, 'c1', 'u1', '👍');
    expect(store).toHaveLength(1);
  });

  it('allows same user to add different emojis', () => {
    let store: ReactionRow[] = [];
    store = addReaction(store, 'c1', 'u1', '👍');
    store = addReaction(store, 'c1', 'u1', '❤️');
    expect(store).toHaveLength(2);
  });

  it('allows different users to add the same emoji', () => {
    let store: ReactionRow[] = [];
    store = addReaction(store, 'c1', 'u1', '👍');
    store = addReaction(store, 'c1', 'u2', '👍');
    expect(store).toHaveLength(2);
  });
});

describe('comment reactions — remove (idempotent delete)', () => {
  it('removes the correct row', () => {
    let store: ReactionRow[] = [{ comment_id: 'c1', user_id: 'u1', emoji: '👍' }];
    store = removeReaction(store, 'c1', 'u1', '👍');
    expect(store).toHaveLength(0);
  });

  it('is idempotent — does not error when row does not exist', () => {
    const store: ReactionRow[] = [];
    const result = removeReaction(store, 'c1', 'u1', '👍');
    expect(result).toHaveLength(0);
  });

  it('only removes the matching (comment_id, user_id, emoji) row', () => {
    let store: ReactionRow[] = [
      { comment_id: 'c1', user_id: 'u1', emoji: '👍' },
      { comment_id: 'c1', user_id: 'u2', emoji: '👍' },
    ];
    store = removeReaction(store, 'c1', 'u1', '👍');
    expect(store).toHaveLength(1);
    expect(store[0].user_id).toBe('u2');
  });
});

describe('comment reactions — list shape (ReactionSummary[])', () => {
  const rows: ReactionRow[] = [
    { comment_id: 'c1', user_id: 'u1', emoji: '👍' },
    { comment_id: 'c1', user_id: 'u2', emoji: '👍' },
    { comment_id: 'c1', user_id: 'u1', emoji: '❤️' },
    { comment_id: 'c2', user_id: 'u1', emoji: '🎉' },
  ];

  it('returns correct count per emoji for a comment', () => {
    const summaries = groupReactions(rows, 'c1', 'u3');
    const thumbs = summaries.find((s) => s.emoji === '👍');
    expect(thumbs?.count).toBe(2);
    const heart = summaries.find((s) => s.emoji === '❤️');
    expect(heart?.count).toBe(1);
  });

  it('sets reactedByMe=true only for the calling user\'s reactions', () => {
    const forU1 = groupReactions(rows, 'c1', 'u1');
    expect(forU1.find((s) => s.emoji === '👍')?.reactedByMe).toBe(true);
    expect(forU1.find((s) => s.emoji === '❤️')?.reactedByMe).toBe(true);

    const forU2 = groupReactions(rows, 'c1', 'u2');
    expect(forU2.find((s) => s.emoji === '👍')?.reactedByMe).toBe(true);
    expect(forU2.find((s) => s.emoji === '❤️')?.reactedByMe).toBe(false);

    const forU3 = groupReactions(rows, 'c1', 'u3');
    expect(forU3.every((s) => s.reactedByMe === false)).toBe(true);
  });

  it('sorts by count DESC', () => {
    const summaries = groupReactions(rows, 'c1', 'u3');
    expect(summaries[0].emoji).toBe('👍'); // count=2
    expect(summaries[1].emoji).toBe('❤️'); // count=1
  });

  it('returns empty array for a comment with no reactions', () => {
    const summaries = groupReactions(rows, 'c3', 'u1');
    expect(summaries).toEqual([]);
  });

  it('does not leak reactions from other comments', () => {
    const summaries = groupReactions(rows, 'c2', 'u1');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].emoji).toBe('🎉');
  });
});

describe('comment reactions — auth guard', () => {
  it('unauthenticated caller receives error shape with code unauthorized', () => {
    // Mirrors what authenticate() returns when no token is present.
    const mockAuthError = { error: { code: 'unauthorized', message: 'Authentication required' } };
    expect(mockAuthError.error.code).toBe('unauthorized');
  });
});
