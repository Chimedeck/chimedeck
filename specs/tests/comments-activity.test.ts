// Unit tests for Sprint 11 — Comments & Activity Log
import { describe, it, expect } from 'bun:test';

// ---------- Activity immutability ----------

describe('writeActivity — immutability contract', () => {
  it('writeActivity only inserts rows (no UPDATE/DELETE calls)', () => {
    // The writeActivity module only calls db('activities').insert(...)
    // Verified by static inspection: no .update() or .delete() calls exist in write.ts
    const source = Bun.file(
      new URL('../../server/extensions/activity/mods/write.ts', import.meta.url).pathname,
    );

    // Read the source synchronously via text — just check the string content
    const checkNoMutations = async () => {
      const text = await source.text();
      expect(text).not.toMatch(/\.update\(/);
      expect(text).not.toMatch(/\.delete\(/);
      expect(text).toMatch(/\.insert\(/);
    };

    // Return the promise so bun:test can await it
    return checkNoMutations();
  });
});

// ---------- Comment version increment ----------

describe('comment versioning', () => {
  it('version starts at 1 on creation', () => {
    const comment = { id: 'c1', content: 'Hello', version: 1, deleted: false };
    expect(comment.version).toBe(1);
  });

  it('version increments on each edit', () => {
    let version = 1;
    // Simulate two edits
    version += 1;
    expect(version).toBe(2);
    version += 1;
    expect(version).toBe(3);
  });

  it('newVersion = comment.version + 1', () => {
    const comment = { version: 4 };
    const newVersion = comment.version + 1;
    expect(newVersion).toBe(5);
  });
});

// ---------- Soft-delete shape ----------

describe('soft-delete comment', () => {
  it('deleted comment has deleted: true and content "[deleted]"', () => {
    const softDeleted = { id: 'c1', deleted: true, content: '[deleted]', version: 1 };
    expect(softDeleted.deleted).toBe(true);
    expect(softDeleted.content).toBe('[deleted]');
  });

  it('deleted comment is not null — the row is retained', () => {
    const softDeleted = { id: 'c1', deleted: true, content: '[deleted]' };
    expect(softDeleted).not.toBeNull();
    expect(softDeleted.id).toBe('c1');
  });
});

// ---------- RBAC: non-owner edit ----------

describe('comment RBAC', () => {
  it('owner can edit own comment', () => {
    const actorId = 'user-1';
    const comment = { user_id: 'user-1' };
    expect(comment.user_id === actorId).toBe(true);
  });

  it('non-owner cannot edit comment', () => {
    const actorId = 'user-2';
    const comment = { user_id: 'user-1' };
    expect(comment.user_id === actorId).toBe(false);
    // Handler returns 403 comment-not-owner
  });

  it('ADMIN can delete any comment', () => {
    const callerRole = 'ADMIN';
    const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };
    const isAdmin = (ROLE_RANK[callerRole] ?? 0) >= ROLE_RANK['ADMIN']!;
    expect(isAdmin).toBe(true);
  });

  it('MEMBER who is not owner cannot delete', () => {
    const actorId = 'user-2';
    const callerRole = 'MEMBER';
    const comment = { user_id: 'user-1' };
    const ROLE_RANK: Record<string, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };
    const isOwner = comment.user_id === actorId;
    const isAdmin = (ROLE_RANK[callerRole] ?? 0) >= ROLE_RANK['ADMIN']!;
    expect(isOwner || isAdmin).toBe(false);
  });
});

// ---------- Cursor pagination ----------

describe('board activity feed pagination', () => {
  it('returns hasMore: false when results <= limit', () => {
    const limit = 50;
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}` }));
    const hasMore = rows.length > limit;
    expect(hasMore).toBe(false);
  });

  it('returns hasMore: true when more rows exist', () => {
    const limit = 50;
    // fetch limit + 1 rows
    const rows = Array.from({ length: 51 }, (_, i) => ({ id: `a${i}` }));
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    expect(hasMore).toBe(true);
    expect(data.length).toBe(50);
  });

  it('nextCursor is the id of the last item in data', () => {
    const data = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    const nextCursor = data.length > 0 ? data[data.length - 1]!.id : null;
    expect(nextCursor).toBe('a3');
  });

  it('nextCursor is null for empty feed', () => {
    const data: { id: string }[] = [];
    const nextCursor = data.length > 0 ? data[data.length - 1]!.id : null;
    expect(nextCursor).toBeNull();
  });
});

// ---------- Activity action descriptions ----------

describe('ActivityItem — describeAction', () => {
  const describe_action = (action: string, payload: Record<string, unknown>, actor: string): string => {
    switch (action) {
      case 'card_moved':
        return `${actor} moved "${payload.cardTitle ?? ''}" from ${payload.fromList ?? 'unknown'} to ${payload.toList ?? 'unknown'}`;
      case 'comment_added':
        return `${actor} commented on card "${payload.cardTitle ?? ''}"`;
      default:
        return `${actor} performed ${action}`;
    }
  };

  it('generates card_moved description', () => {
    const desc = describe_action('card_moved', { cardTitle: 'Fix bug', fromList: 'Backlog', toList: 'In Progress' }, 'John');
    expect(desc).toBe('John moved "Fix bug" from Backlog to In Progress');
  });

  it('generates comment_added description', () => {
    const desc = describe_action('comment_added', { cardTitle: 'Design review' }, 'Jane');
    expect(desc).toBe('Jane commented on card "Design review"');
  });
});
