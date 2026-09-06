import { describe, expect, test } from 'bun:test';

// ---------------------------------------------------------------------------
// Pure helpers that build the enriched `mention` webhook payload context.
// These tests intentionally avoid DB/network mocks — inputs are plain strings.
// ---------------------------------------------------------------------------
const { buildSourcePreview, buildActorDisplayName, buildMentionWebhookPayload } =
  await import('../mentionWebhookContext');

describe('buildSourcePreview — plain-text, bounded source summary', () => {
  test('strips HTML markup and decodes entities to plain text', () => {
    expect(buildSourcePreview({ sourceText: '<p>Hi <b>@alice</b>, please review</p>' })).toBe(
      'Hi @alice, please review'
    );
  });

  test('preserves readable spacing across rich-text block elements', () => {
    expect(
      buildSourcePreview({
        sourceText: '<p>First point</p><p>Second point</p><ul><li>Third point</li></ul>',
      })
    ).toBe('First point Second point Third point');
  });

  test('collapses newlines, tabs, and control characters into single spaces', () => {
    expect(buildSourcePreview({ sourceText: 'line1\nline2\ttabbed\u0000ctrl  spaced' })).toBe(
      'line1 line2 tabbed ctrl spaced'
    );
  });

  test('caps preview at a total of 200 characters including the ellipsis when truncated', () => {
    const out = buildSourcePreview({ sourceText: 'x'.repeat(500) });
    expect(out.length).toBe(200);
    expect(out.startsWith('x'.repeat(199))).toBe(true);
    expect(out.endsWith('…')).toBe(true);
  });

  test('does not append ellipsis when the text fits exactly within the cap', () => {
    expect(buildSourcePreview({ sourceText: 'y'.repeat(200) })).toBe('y'.repeat(200));
  });

  test('returns empty string for empty or whitespace-only input', () => {
    expect(buildSourcePreview({ sourceText: '' })).toBe('');
    expect(buildSourcePreview({ sourceText: '   \n\t  ' })).toBe('');
    expect(buildSourcePreview({ sourceText: undefined })).toBe('');
  });
});

describe('buildActorDisplayName — nickname preferred, never an email', () => {
  test('returns the nickname when present', () => {
    expect(buildActorDisplayName({ nickname: 'alice', name: 'Alice Smith' })).toBe('alice');
  });

  test('trims surrounding whitespace from the nickname', () => {
    expect(buildActorDisplayName({ nickname: '  alice  ', name: 'Alice Smith' })).toBe('alice');
  });

  test('falls back to a non-email display name when nickname is empty', () => {
    expect(buildActorDisplayName({ nickname: '', name: 'Alice Smith' })).toBe('Alice Smith');
    expect(buildActorDisplayName({ nickname: null, name: 'Alice Smith' })).toBe('Alice Smith');
    expect(buildActorDisplayName({ nickname: undefined, name: 'Alice Smith' })).toBe('Alice Smith');
  });

  test('returns null when the only available name looks like an email address', () => {
    expect(buildActorDisplayName({ nickname: '', name: 'alice@example.com' })).toBe(null);
    expect(buildActorDisplayName({ nickname: '', name: 'Alice <alice@example.com>' })).toBe(null);
    expect(buildActorDisplayName({ nickname: null, name: null })).toBe(null);
    expect(buildActorDisplayName({ nickname: undefined, name: undefined })).toBe(null);
  });

  test('skips an email-like nickname and falls back to the non-email name', () => {
    expect(buildActorDisplayName({ nickname: 'alice@example.com', name: 'Alice Smith' })).toBe(
      'Alice Smith'
    );
  });
});

describe('buildMentionWebhookPayload — stable enriched contract', () => {
  test('preserves legacy identifiers and adds safe display context', () => {
    expect(
      buildMentionWebhookPayload({
        boardId: 'board-1',
        cardId: 'card-1',
        sourceType: 'comment',
        sourceId: 'comment-1',
        actorId: 'actor-1',
        recipients: ['user-1'],
        cardTitle: 'Fix login flow',
        boardName: 'Phoenix Ops',
        sourceText: '<p>Please review\nthis before Friday.</p>',
        actor: { nickname: 'maria', name: 'Maria Silva' },
      })
    ).toEqual({
      boardId: 'board-1',
      cardId: 'card-1',
      sourceType: 'comment',
      sourceId: 'comment-1',
      actorId: 'actor-1',
      mentionedUserIds: ['user-1'],
      cardTitle: 'Fix login flow',
      boardTitle: 'Phoenix Ops',
      sourcePreview: 'Please review this before Friday.',
      actorName: 'maria',
    });
  });
});
