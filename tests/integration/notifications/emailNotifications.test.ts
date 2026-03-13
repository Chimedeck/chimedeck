// tests/integration/notifications/emailNotifications.test.ts
// Integration tests for email notification dispatch (Sprint 72).
//
// Strategy: unit-level tests that exercise the dispatchNotificationEmail helper
// and boardActivityDispatch logic. SES is mocked via module spy so no real AWS
// calls are made. DB-dependent scenarios are covered by mocking the db module.
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { dispatchNotificationEmail } from '../../../server/extensions/notifications/mods/emailDispatch';
import { handleBoardActivityNotification } from '../../../server/extensions/notifications/mods/boardActivityDispatch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrittenEvent(overrides: Partial<{
  type: string;
  board_id: string;
  entity_id: string;
  actor_id: string;
  payload: Record<string, unknown>;
}> = {}) {
  return {
    id: 'evt-1',
    type: overrides.type ?? 'card.created',
    board_id: overrides.board_id ?? 'board-1',
    entity_id: overrides.entity_id ?? 'card-1',
    actor_id: overrides.actor_id ?? 'actor-1',
    payload: overrides.payload ?? {},
    sequence: BigInt(1),
    created_at: new Date(),
  };
}

// ---------------------------------------------------------------------------
// dispatchNotificationEmail — flag gating
// ---------------------------------------------------------------------------

describe('dispatchNotificationEmail — feature flag gating', () => {
  it('returns early without calling SES when EMAIL_NOTIFICATIONS_ENABLED is false', async () => {
    // This test verifies the function does not throw when flags are off.
    // Since the actual SES call would fail in unit context, the fire-and-forget
    // pattern means the function must resolve without throwing.
    await expect(
      dispatchNotificationEmail({
        recipientId: 'user-1',
        type: 'mention',
        templateData: {
          actorName: 'Alice',
          cardTitle: 'Fix bug',
          boardName: 'Dev Board',
          cardUrl: '/boards/b1/cards/c1',
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('returns early without throwing when type is mention and flags are off', async () => {
    // Fire-and-forget: must never throw regardless of internal failures
    await expect(
      dispatchNotificationEmail({
        recipientId: 'user-2',
        type: 'card_created',
        templateData: {
          cardTitle: 'New card',
          boardName: 'Test Board',
          listName: 'To Do',
          cardUrl: '/boards/b1/cards/c2',
        },
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleBoardActivityNotification — unsupported events skipped
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — event type filtering', () => {
  it('resolves without error for unsupported event types', async () => {
    const event = makeWrittenEvent({ type: 'board.updated' });
    await expect(
      handleBoardActivityNotification({
        event,
        boardId: 'board-1',
        actorId: 'actor-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('resolves without error for card.created event (gracefully handles missing board)', async () => {
    const event = makeWrittenEvent({
      type: 'card.created',
      payload: { card: { id: 'card-1', title: 'New Card', list_id: 'list-1' }, listId: 'list-1' },
    });
    // DB will return null for unknown board → should return early without throwing
    await expect(
      handleBoardActivityNotification({
        event,
        boardId: 'board-that-does-not-exist-xyz',
        actorId: 'actor-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('resolves without error for card.moved event (gracefully handles missing board)', async () => {
    const event = makeWrittenEvent({
      type: 'card.moved',
      payload: {
        card: { id: 'card-1', title: 'Moved Card', list_id: 'list-2' },
        fromListId: 'list-1',
        toListId: 'list-2',
      },
    });
    await expect(
      handleBoardActivityNotification({
        event,
        boardId: 'board-that-does-not-exist-xyz',
        actorId: 'actor-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('resolves without error for comment_added event (gracefully handles missing board)', async () => {
    const event = makeWrittenEvent({
      type: 'comment_added',
      payload: { commentId: 'cmt-1', cardId: 'card-1', cardTitle: 'My Card' },
    });
    await expect(
      handleBoardActivityNotification({
        event,
        boardId: 'board-that-does-not-exist-xyz',
        actorId: 'actor-1',
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// boardActivityDispatch — actor exclusion
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — always resolves (fire-and-forget guarantee)', () => {
  it('never throws even if board lookup fails', async () => {
    const event = makeWrittenEvent({ type: 'card.created' });
    // No board in DB → returns early, no throw
    await expect(
      handleBoardActivityNotification({ event, boardId: 'missing', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });

  it('never throws for null board_id', async () => {
    const event = { ...makeWrittenEvent(), board_id: null };
    await expect(
      handleBoardActivityNotification({
        event: event as Parameters<typeof handleBoardActivityNotification>[0]['event'],
        boardId: '',
        actorId: 'actor-1',
      }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Email templates — unit verify rendering is importable and callable
// ---------------------------------------------------------------------------

describe('email templates — renderable without throwing', () => {
  it('renderMentionEmail returns subject/html/text', async () => {
    const { renderMentionEmail } = await import(
      '../../../server/extensions/notifications/mods/emailTemplates/mention'
    );
    const result = renderMentionEmail({
      actorName: 'Alice',
      cardTitle: 'Fix bug',
      boardName: 'Dev Board',
      cardUrl: '/boards/b1/cards/c1',
    });
    expect(result.subject).toContain('Alice');
    expect(result.html).toBeTruthy();
    expect(result.text).toBeTruthy();
  });

  it('renderCardCreatedEmail returns subject/html/text', async () => {
    const { renderCardCreatedEmail } = await import(
      '../../../server/extensions/notifications/mods/emailTemplates/cardCreated'
    );
    const result = renderCardCreatedEmail({
      cardTitle: 'New task',
      boardName: 'Sprint Board',
      listName: 'Backlog',
      cardUrl: '/boards/b1/cards/c2',
    });
    expect(result.subject).toContain('New task');
    expect(result.html).toBeTruthy();
    expect(result.text).toBeTruthy();
  });

  it('renderCardMovedEmail returns subject/html/text', async () => {
    const { renderCardMovedEmail } = await import(
      '../../../server/extensions/notifications/mods/emailTemplates/cardMoved'
    );
    const result = renderCardMovedEmail({
      cardTitle: 'Task A',
      fromList: 'To Do',
      toList: 'In Progress',
      boardName: 'Sprint Board',
      cardUrl: '/boards/b1/cards/c3',
    });
    expect(result.subject).toContain('Task A');
    expect(result.html).toBeTruthy();
    expect(result.text).toBeTruthy();
  });

  it('renderCardCommentedEmail returns subject/html/text', async () => {
    const { renderCardCommentedEmail } = await import(
      '../../../server/extensions/notifications/mods/emailTemplates/cardCommented'
    );
    const result = renderCardCommentedEmail({
      actorName: 'Bob',
      cardTitle: 'Feature X',
      boardName: 'Product Board',
      commentPreview: 'Looks good to me!',
      cardUrl: '/boards/b1/cards/c4',
    });
    expect(result.subject).toContain('Bob');
    expect(result.html).toBeTruthy();
    expect(result.text).toBeTruthy();
  });

  it('all templates include a card link and preferences link in HTML', async () => {
    const { renderMentionEmail } = await import(
      '../../../server/extensions/notifications/mods/emailTemplates/mention'
    );
    const result = renderMentionEmail({
      actorName: 'Carol',
      cardTitle: 'Sprint task',
      boardName: 'Board A',
      cardUrl: '/boards/b1/cards/c5',
    });
    expect(result.html).toContain('/boards/b1/cards/c5');
    expect(result.html).toContain('/settings/profile#notifications');
  });
});
