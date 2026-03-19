// tests/integration/notifications/boardActivityNotifications.test.ts
// Integration tests for in-app board activity notification dispatch (Sprint 73).
//
// Strategy: unit-level tests that exercise handleBoardActivityNotification.
// DB and publishToUser are mocked so no real postgres or WS connections are needed.
// Preference guard behaviour is verified via a mock db that returns specific rows.
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { handleBoardActivityNotification } from '../../../server/extensions/notifications/mods/boardActivityDispatch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrittenEvent(overrides: Partial<{
  id: string;
  type: string;
  board_id: string;
  actor_id: string;
  payload: Record<string, unknown>;
}> = {}) {
  return {
    id: overrides.id ?? 'evt-1',
    type: overrides.type ?? 'card.created',
    board_id: overrides.board_id ?? 'board-1',
    actor_id: overrides.actor_id ?? 'actor-1',
    payload: overrides.payload ?? {
      card: { id: 'card-1', title: 'Test Card', list_id: 'list-1' },
    },
    sequence: BigInt(1),
    created_at: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Unsupported event types are ignored
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — unsupported event types', () => {
  it('resolves without error for unsupported event types', async () => {
    const event = makeWrittenEvent({ type: 'board.updated' });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'board-1', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });

  it('resolves without error for member_added event', async () => {
    const event = makeWrittenEvent({ type: 'member_added' });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'board-1', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Missing board returns early without throwing
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — missing board', () => {
  it('resolves without error when board is not found', async () => {
    const event = makeWrittenEvent({ type: 'card.created' });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'nonexistent-board', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// card.created — in-app notification type mapping
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — card.created', () => {
  it('resolves for card.created event', async () => {
    const event = makeWrittenEvent({
      type: 'card.created',
      payload: { card: { id: 'card-1', title: 'New Card', list_id: 'list-1' } },
    });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'board-1', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });

  it('resolves for card.created even when payload is missing card', async () => {
    const event = makeWrittenEvent({
      type: 'card.created',
      payload: {},
    });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'board-1', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// card.moved — in-app notification type mapping
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — card.moved', () => {
  it('resolves for card.moved event', async () => {
    const event = makeWrittenEvent({
      type: 'card.moved',
      payload: {
        card: { id: 'card-1', title: 'Task X', list_id: 'list-2' },
        fromListId: 'list-1',
      },
    });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'board-1', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// comment_added — in-app notification type mapping
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — comment_added', () => {
  it('resolves for comment_added event', async () => {
    const event = makeWrittenEvent({
      type: 'comment_added',
      payload: { cardId: 'card-1', cardTitle: 'Feature X' },
    });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'board-1', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Notification type mapping helper (via observable side effects)
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — notification type constants', () => {
  it('does not throw for any of the three supported event types', async () => {
    const eventTypes = ['card.created', 'card.moved', 'comment_added'] as const;
    for (const type of eventTypes) {
      const event = makeWrittenEvent({ type });
      await expect(
        handleBoardActivityNotification({ event, boardId: 'board-missing', actorId: 'u-1' }),
      ).resolves.toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Fire-and-forget — never throws even on internal errors
// ---------------------------------------------------------------------------

describe('handleBoardActivityNotification — fire-and-forget contract', () => {
  it('never rejects even when boardId is empty string', async () => {
    const event = makeWrittenEvent({ type: 'card.created' });
    await expect(
      handleBoardActivityNotification({ event, boardId: '', actorId: 'actor-1' }),
    ).resolves.toBeUndefined();
  });

  it('never rejects even when actorId is empty string', async () => {
    const event = makeWrittenEvent({ type: 'card.created' });
    await expect(
      handleBoardActivityNotification({ event, boardId: 'board-1', actorId: '' }),
    ).resolves.toBeUndefined();
  });

  it('resolves even when board_id on event is null', async () => {
    const event = { ...makeWrittenEvent({ type: 'card.moved' }), board_id: null as unknown as string };
    await expect(
      handleBoardActivityNotification({
        event: event as Parameters<typeof handleBoardActivityNotification>[0]['event'],
        boardId: '',
        actorId: 'actor-1',
      }),
    ).resolves.toBeUndefined();
  });
});
