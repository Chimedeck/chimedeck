// Tests for card-chat activity emission — verify event dispatch.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockDispatchEvent = mock(() => Promise.resolve());

// [why] Only mock mods/events/dispatch — avoid mock.module for common/db
// because it causes a module-cache deadlock when goalLoop.test.ts imports
// the real common/db in the same process (Bun edge case with mock.module).
mock.module('../../../../../mods/events/dispatch', () => ({ dispatchEvent: mockDispatchEvent }));

beforeEach(() => {
  mockDispatchEvent.mockClear();
});

describe('emitCardChatActivity', () => {
  it('dispatches a card_ai_assist_paused event with correct payload', async () => {
    const { emitCardChatActivity } = await import('../index');

    mockDispatchEvent.mockResolvedValueOnce(undefined);

    await emitCardChatActivity({
      type: 'card_ai_assist_paused',
      cardId: 'card-1',
      sessionId: 'session-1',
      actorId: 'user-1',
      payload: { pausedAt: '2026-06-10T12:00:00.000Z' },
    });

    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('dispatches a card_ai_assist_started event', async () => {
    const { emitCardChatActivity } = await import('../index');

    mockDispatchEvent.mockResolvedValueOnce(undefined);

    await emitCardChatActivity({
      type: 'card_ai_assist_started',
      cardId: 'card-2',
      sessionId: 'session-2',
      actorId: 'user-2',
    });

    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('does not throw when dispatchEvent rejects — fire-and-forget', async () => {
    const { emitCardChatActivity } = await import('../index');

    mockDispatchEvent.mockRejectedValueOnce(new Error('Event bus unavailable'));

    await expect(
      emitCardChatActivity({
        type: 'card_ai_quality_scored',
        cardId: 'card-3',
        sessionId: 'session-3',
        actorId: 'user-3',
        payload: { score: 85 },
      }),
    ).resolves.toBeUndefined();

    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('dispatches card_ai_question_asked with question payload', async () => {
    const { emitCardChatActivity } = await import('../index');

    mockDispatchEvent.mockResolvedValueOnce(undefined);

    await emitCardChatActivity({
      type: 'card_ai_question_asked',
      cardId: 'card-4',
      sessionId: 'session-4',
      actorId: 'user-4',
      payload: { question: 'What is the expected concurrency?', category: 'constraints' },
    });

    expect(mockDispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'card_ai_question_asked',
      entityId: 'card-4',
      actorId: 'user-4',
      payload: expect.objectContaining({
        sessionId: 'session-4',
        question: 'What is the expected concurrency?',
        category: 'constraints',
      }),
    }));
  });

  it('dispatches card_ai_assist_ready_for_review with quality score', async () => {
    const { emitCardChatActivity } = await import('../index');

    mockDispatchEvent.mockResolvedValueOnce(undefined);

    await emitCardChatActivity({
      type: 'card_ai_assist_ready_for_review',
      cardId: 'card-5',
      sessionId: 'session-5',
      actorId: 'user-5',
      payload: { qualityScore: 95, breakdown: { total: 95 } },
    });

    expect(mockDispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'card_ai_assist_ready_for_review',
      entityId: 'card-5',
      actorId: 'user-5',
      payload: expect.objectContaining({
        sessionId: 'session-5',
        qualityScore: 95,
      }),
    }));
  });
});
