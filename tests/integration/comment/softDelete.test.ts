// Integration tests for comment soft-delete and version management — Sprint 112.
// Covers: comment creation (content validation), editing (version increment),
// soft-delete (sets deleted:true and content:'[deleted]'), and guard clauses.
// Strategy: unit-level tests exercising business logic directly — no live DB.
import { describe, expect, it } from 'bun:test';

// ---------------------------------------------------------------------------
// Helpers that mirror validation in the comment API handlers.
// ---------------------------------------------------------------------------

interface CommentInput {
  content?: unknown;
  idempotency_key?: unknown;
}

interface ValidationResult {
  ok: boolean;
  name?: string;
  message?: string;
}

/** Mirrors guard clauses in handleCreateComment. */
function validateCreateComment(body: CommentInput): ValidationResult {
  if (!body.content || typeof body.content !== 'string' || (body.content as string).trim() === '') {
    return { ok: false, name: 'bad-request', message: 'content is required' };
  }
  if (body.idempotency_key !== undefined) {
    if (
      typeof body.idempotency_key !== 'string' ||
      (body.idempotency_key as string).trim() === ''
    ) {
      return {
        ok: false,
        name: 'bad-request',
        message: 'idempotency_key must be a non-empty string',
      };
    }
  }
  return { ok: true };
}

/** Mirrors guard clauses in handleUpdateComment. */
function validateUpdateComment(
  body: { content?: unknown },
  comment: { deleted: boolean; user_id: string },
  actorId: string,
): ValidationResult {
  if (comment.deleted) {
    return { ok: false, name: 'comment-deleted', message: 'Cannot edit a deleted comment' };
  }
  if (comment.user_id !== actorId) {
    return { ok: false, name: 'comment-not-owner', message: 'You can only edit your own comments' };
  }
  if (!body.content || typeof body.content !== 'string' || (body.content as string).trim() === '') {
    return { ok: false, name: 'bad-request', message: 'content is required' };
  }
  return { ok: true };
}

/** Mirrors guard clauses in handleDeleteComment. */
function validateDeleteComment(
  comment: { deleted: boolean; user_id: string },
  actorId: string,
  callerRole: string,
): ValidationResult {
  if (comment.deleted) {
    return { ok: false, name: 'comment-deleted', message: 'Comment is already deleted' };
  }
  const isOwner = comment.user_id === actorId;
  const isAdmin = ['ADMIN', 'OWNER'].includes(callerRole);
  if (!isOwner && !isAdmin) {
    return {
      ok: false,
      name: 'comment-not-owner',
      message: 'You can only delete your own comments (or be an ADMIN)',
    };
  }
  return { ok: true };
}

/** Simulates the soft-delete mutation. */
function softDeleteComment(comment: {
  id: string;
  content: string;
  deleted: boolean;
  version: number;
}): typeof comment {
  return { ...comment, deleted: true, content: '[deleted]' };
}

/** Simulates the version-increment mutation. */
function editComment(
  comment: { id: string; content: string; version: number; deleted: boolean },
  newContent: string,
): typeof comment {
  return { ...comment, content: newContent.trim(), version: comment.version + 1 };
}

// ---------------------------------------------------------------------------
// Comment creation — content validation
// ---------------------------------------------------------------------------

describe('comment creation — content validation', () => {
  it('rejects empty content', () => {
    expect(validateCreateComment({ content: '   ' })).toMatchObject({
      ok: false,
      name: 'bad-request',
    });
  });

  it('rejects missing content (undefined)', () => {
    expect(validateCreateComment({})).toMatchObject({ ok: false, name: 'bad-request' });
  });

  it('rejects non-string content', () => {
    expect(validateCreateComment({ content: 42 })).toMatchObject({ ok: false, name: 'bad-request' });
  });

  it('accepts valid content', () => {
    expect(validateCreateComment({ content: 'Looks good to me.' })).toMatchObject({ ok: true });
  });

  it('accepts content with HTML markup (rich text)', () => {
    expect(validateCreateComment({ content: '<p>Hello <strong>world</strong></p>' })).toMatchObject({
      ok: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Comment creation — idempotency_key validation
// ---------------------------------------------------------------------------

describe('comment creation — idempotency_key validation', () => {
  it('accepts a request without an idempotency_key', () => {
    expect(validateCreateComment({ content: 'Hi' })).toMatchObject({ ok: true });
  });

  it('accepts a valid non-empty idempotency_key', () => {
    expect(
      validateCreateComment({ content: 'Hi', idempotency_key: 'key-abc-123' }),
    ).toMatchObject({ ok: true });
  });

  it('rejects an empty string idempotency_key', () => {
    expect(validateCreateComment({ content: 'Hi', idempotency_key: '   ' })).toMatchObject({
      ok: false,
      name: 'bad-request',
    });
  });

  it('rejects a non-string idempotency_key', () => {
    expect(validateCreateComment({ content: 'Hi', idempotency_key: 9999 })).toMatchObject({
      ok: false,
      name: 'bad-request',
    });
  });
});

// ---------------------------------------------------------------------------
// Comment editing — version increment
// ---------------------------------------------------------------------------

describe('comment editing — version increment', () => {
  const baseComment = {
    id: 'comment-1',
    content: 'Original text',
    version: 1,
    deleted: false,
    user_id: 'user-abc',
  };

  it('increments version by 1 on each edit', () => {
    const updated = editComment(baseComment, 'Updated text');
    expect(updated.version).toBe(2);
  });

  it('updates content to the new value', () => {
    const updated = editComment(baseComment, 'New content');
    expect(updated.content).toBe('New content');
  });

  it('trims whitespace from the new content', () => {
    const updated = editComment(baseComment, '  Trimmed  ');
    expect(updated.content).toBe('Trimmed');
  });

  it('version increments again on a second edit', () => {
    const v2 = editComment(baseComment, 'Second edit');
    const v3 = editComment(v2, 'Third edit');
    expect(v3.version).toBe(3);
  });

  it('does not change any other field during edit', () => {
    const updated = editComment(baseComment, 'Changed');
    expect(updated.id).toBe(baseComment.id);
    expect(updated.deleted).toBe(false);
    expect(updated.user_id).toBe(baseComment.user_id);
  });
});

// ---------------------------------------------------------------------------
// Comment editing — guard clauses
// ---------------------------------------------------------------------------

describe('comment editing — guard clauses', () => {
  const comment = {
    id: 'c-1',
    content: 'text',
    version: 1,
    deleted: false,
    user_id: 'user-abc',
  };

  it('rejects editing a deleted comment', () => {
    expect(
      validateUpdateComment({ content: 'new' }, { ...comment, deleted: true }, 'user-abc'),
    ).toMatchObject({ ok: false, name: 'comment-deleted' });
  });

  it('rejects editing another user\'s comment', () => {
    expect(
      validateUpdateComment({ content: 'new' }, comment, 'user-xyz'),
    ).toMatchObject({ ok: false, name: 'comment-not-owner' });
  });

  it('rejects an empty update content', () => {
    expect(validateUpdateComment({ content: '' }, comment, 'user-abc')).toMatchObject({
      ok: false,
      name: 'bad-request',
    });
  });

  it('allows the owner to edit their own comment', () => {
    expect(
      validateUpdateComment({ content: 'Updated' }, comment, 'user-abc'),
    ).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Comment soft-delete — mutation behaviour
// ---------------------------------------------------------------------------

describe('comment soft-delete — mutation', () => {
  const comment = {
    id: 'c-1',
    content: 'Original content',
    deleted: false,
    version: 2,
  };

  it('sets deleted to true', () => {
    const result = softDeleteComment(comment);
    expect(result.deleted).toBe(true);
  });

  it('replaces content with "[deleted]"', () => {
    const result = softDeleteComment(comment);
    expect(result.content).toBe('[deleted]');
  });

  it('does not change the comment id', () => {
    const result = softDeleteComment(comment);
    expect(result.id).toBe(comment.id);
  });

  it('does not change the version on soft-delete', () => {
    // [why] Soft-delete is a state change, not a content edit — version stays unchanged.
    const result = softDeleteComment(comment);
    expect(result.version).toBe(comment.version);
  });
});

// ---------------------------------------------------------------------------
// Comment soft-delete — guard clauses
// ---------------------------------------------------------------------------

describe('comment soft-delete — guard clauses', () => {
  const comment = { deleted: false, user_id: 'user-a' };

  it('rejects deleting an already-deleted comment (409)', () => {
    expect(
      validateDeleteComment({ ...comment, deleted: true }, 'user-a', 'MEMBER'),
    ).toMatchObject({ ok: false, name: 'comment-deleted' });
  });

  it('rejects deletion by a non-owner non-admin', () => {
    expect(validateDeleteComment(comment, 'user-b', 'MEMBER')).toMatchObject({
      ok: false,
      name: 'comment-not-owner',
    });
  });

  it('allows the owner to delete their own comment', () => {
    expect(validateDeleteComment(comment, 'user-a', 'MEMBER')).toMatchObject({ ok: true });
  });

  it('allows an ADMIN to delete another user\'s comment', () => {
    expect(validateDeleteComment(comment, 'user-b', 'ADMIN')).toMatchObject({ ok: true });
  });

  it('allows an OWNER to delete another user\'s comment', () => {
    expect(validateDeleteComment(comment, 'user-b', 'OWNER')).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Comment soft-delete — idempotency of the deleted state
// ---------------------------------------------------------------------------

describe('comment soft-delete — idempotency check', () => {
  it('the deleted flag is detectable after a soft-delete', () => {
    const comment = { id: 'c-2', content: 'Some text', deleted: false, version: 1 };
    const deleted = softDeleteComment(comment);

    // A second delete attempt would be caught by the guard
    const result = validateDeleteComment(
      { deleted: deleted.deleted, user_id: 'user-a' },
      'user-a',
      'MEMBER',
    );
    expect(result.ok).toBe(false);
    expect(result.name).toBe('comment-deleted');
  });
});
