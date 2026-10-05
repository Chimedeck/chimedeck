// Tests for the BA persona goal loop — multi-turn refinement orchestrator.
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const sessionId = 'session-abc';
const cardId = 'card-1';
const userId = 'user-1';

const activeSession = {
  id: sessionId,
  card_id: cardId,
  workspace_id: 'ws-1',
  created_by: userId,
  status: 'ACTIVE_REFINEMENT' as const,
  quality_score: null,
  last_actor_at: '2026-06-01T00:00:00.000Z',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
};

const sampleScore = {
  earsCoverage: 22,
  acceptanceCriteria: 23,
  constraintClarity: 23,
  testability: 24,
  ambiguityPenalty: 2,
  total: 90,
};

let runGoalLoop: typeof import('../goalLoop').runGoalLoop;
let deps: typeof import('../goalLoop').goalLoopDeps;

beforeEach(async () => {
  const mod = await import('../goalLoop');
  runGoalLoop = mod.runGoalLoop;
  deps = mod.goalLoopDeps;

  deps.fetchSession = mock((_sid: string, _cid: string) => Promise.resolve(activeSession));
  deps.fetchCard = mock((_cid: string) =>
    Promise.resolve({ id: cardId, title: 'Test Card', description: null })
  );
  deps.fetchRecentUserMessages = mock((_sid: string) =>
    Promise.resolve([
      {
        id: 'u1',
        session_id: sessionId,
        role: 'user' as const,
        content: 'Initial question',
        metadata: null,
        author_id: userId,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ])
  );
  deps.requestCardChatCompletion = mock(() =>
    Promise.resolve({
      status: 200,
      data: { model: 'gpt-4.1-mini', message: 'What are the constraints?' },
    })
  );
  deps.detectCoveredCategories = mock(() => ['business_value']);
  deps.selectNextQuestionCategory = mock(() => 'acceptance_criteria' as const);
  deps.buildCategoryQuestion = mock(() => 'What acceptance criteria apply?');
  deps.buildBAPersonaSystemPrompt = mock(() => 'You are a BA...');
  deps.computeQualityScore = mock(() => sampleScore);
  deps.writeCardChatMessage = mock((input: { role: string; content: string }) =>
    Promise.resolve({
      status: 201,
      data: {
        message: {
          id: 'assist-msg',
          session_id: sessionId,
          role: input.role,
          content: input.content,
          metadata: null,
          author_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    })
  );
  deps.updateSession = mock(() => Promise.resolve(undefined));
  deps.emitCardChatActivity = mock(() => Promise.resolve(undefined));
  deps.updateCardDescription = mock(() => Promise.resolve(undefined));
  deps.db = mock((_tableName: string) => {
    const chainProxy = new Proxy({} as Record<string, unknown>, {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined;
        return mock(() => chainProxy);
      },
    });
    return chainProxy;
  }) as unknown as typeof deps.db;
});

describe('runGoalLoop', () => {
  it('returns 404 when session is not found', async () => {
    deps.fetchSession = mock(() => Promise.resolve(null));
    const result = await runGoalLoop({ sessionId, cardId, userId });
    expect(result.status).toBe(404);
    expect(result.name).toBe('session-not-found');
  });

  it('returns 409 when session is not ACTIVE_REFINEMENT', async () => {
    deps.fetchSession = mock(() =>
      Promise.resolve({ ...activeSession, status: 'PAUSED' as const })
    );
    const result = await runGoalLoop({ sessionId, cardId, userId });
    expect(result.status).toBe(409);
    expect(result.name).toBe('session-not-active');
  });

  it('returns 404 when card is not found', async () => {
    deps.fetchCard = mock(() => Promise.resolve(null));
    const result = await runGoalLoop({ sessionId, cardId, userId });
    expect(result.status).toBe(404);
    expect(result.name).toBe('card-not-found');
  });

  it('runs a single turn and returns READY_FOR_REVIEW when score reaches threshold', async () => {
    let storedStatus = 'ACTIVE_REFINEMENT';
    let storedScore: number | null = null;
    deps.fetchSession = mock(() =>
      Promise.resolve({ ...activeSession, status: storedStatus, quality_score: storedScore })
    );
    deps.updateSession = mock(
      (_sid: string, updates: { status?: string; quality_score?: number | null }) => {
        if (updates.status) storedStatus = updates.status;
        if (updates.quality_score !== undefined) storedScore = updates.quality_score;
        return Promise.resolve(undefined);
      }
    );

    const result = await runGoalLoop({ sessionId, cardId, userId });

    expect(result.status).toBe(200);
    expect(result.data?.loopComplete).toBe(true);
    expect(result.data?.session.status).toBe('READY_FOR_REVIEW');
    expect(deps.requestCardChatCompletion).toHaveBeenCalledTimes(1);
    expect(deps.computeQualityScore).toHaveBeenCalledTimes(1);
  });

  it('runs multiple turns when score is below threshold on first turn', async () => {
    let callCount = 0;
    deps.computeQualityScore = mock(() => {
      callCount++;
      if (callCount <= 2) {
        return {
          earsCoverage: 10,
          acceptanceCriteria: 10,
          constraintClarity: 10,
          testability: 10,
          ambiguityPenalty: 5,
          total: 35,
        };
      }
      return {
        earsCoverage: 22,
        acceptanceCriteria: 23,
        constraintClarity: 23,
        testability: 24,
        ambiguityPenalty: 2,
        total: 92,
      };
    });

    const result = await runGoalLoop({ sessionId, cardId, userId });

    expect(result.status).toBe(200);
    expect(result.data?.loopComplete).toBe(true);
    expect(deps.requestCardChatCompletion).toHaveBeenCalledTimes(3);
  });

  it('stops at MAX_REFINEMENT_TURNS and returns loopComplete=false when threshold never met', async () => {
    deps.computeQualityScore = mock(() => ({
      earsCoverage: 10,
      acceptanceCriteria: 10,
      constraintClarity: 10,
      testability: 10,
      ambiguityPenalty: 5,
      total: 35,
    }));

    const result = await runGoalLoop({ sessionId, cardId, userId });

    expect(result.data?.loopComplete).toBe(false);
    expect(deps.requestCardChatCompletion).toHaveBeenCalledTimes(8);
  });

  it('builds the BA persona system prompt using card title and description', async () => {
    deps.fetchCard = mock(() =>
      Promise.resolve({ id: cardId, title: 'My Card', description: 'Some description' })
    );

    await runGoalLoop({ sessionId, cardId, userId });

    expect(deps.buildBAPersonaSystemPrompt).toHaveBeenCalled();
    const call = (deps.buildBAPersonaSystemPrompt as ReturnType<typeof mock>).mock.calls[0]?.[0] as
      | { cardTitle?: string; cardDescription?: string }
      | undefined;
    expect(call?.cardTitle).toBe('My Card');
    expect(call?.cardDescription).toBe('Some description');
  });

  it('includes recent user messages in conversation context', async () => {
    deps.fetchRecentUserMessages = mock(() =>
      Promise.resolve([
        {
          id: 'u1',
          session_id: sessionId,
          role: 'user' as const,
          content: 'User question about requirements',
          metadata: null,
          author_id: userId,
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
        },
      ])
    );

    await runGoalLoop({ sessionId, cardId, userId });

    const call = (deps.requestCardChatCompletion as ReturnType<typeof mock>).mock.calls[0]?.[0] as
      | { messages: Array<{ role: string; content: string }> }
      | undefined;
    expect(call).toBeDefined();
    const userMsgs = call?.messages.filter((m) => m.role === 'user');
    expect(userMsgs!.length).toBeGreaterThanOrEqual(1);
    expect(userMsgs![userMsgs!.length - 1]?.content).toContain('requirements');
  });

  it('continues from partial progress when a provider error occurs mid-loop', async () => {
    let call = 0;
    deps.computeQualityScore = mock(() => ({
      earsCoverage: 5,
      acceptanceCriteria: 5,
      constraintClarity: 5,
      testability: 5,
      ambiguityPenalty: 5,
      total: 15,
    }));
    deps.requestCardChatCompletion = mock(() => {
      call++;
      if (call === 3)
        return Promise.resolve({ status: 502, name: 'provider-timeout', message: 'timeout' });
      return Promise.resolve({
        status: 200,
        data: { model: 'gpt-4.1-mini', message: 'Here is some refinement.' },
      });
    });

    const result = await runGoalLoop({ sessionId, cardId, userId });

    expect(result.status).toBe(200);
    expect(result.data?.loopComplete).toBe(false);
    expect(call).toBeGreaterThanOrEqual(3);
  });

  it('handles provider returning non-200 status on first turn', async () => {
    deps.requestCardChatCompletion = mock(() =>
      Promise.resolve({ status: 429, name: 'rate-limited', message: 'Rate limited' })
    );
    deps.computeQualityScore = mock(() => ({
      earsCoverage: 5,
      acceptanceCriteria: 5,
      constraintClarity: 5,
      testability: 5,
      ambiguityPenalty: 5,
      total: 15,
    }));

    const result = await runGoalLoop({ sessionId, cardId, userId });

    expect(result.status).toBe(500);
    expect(result.name).toBe('refinement-failed');
  });

  it('passes user contents to detectCoveredCategories for each turn', async () => {
    deps.computeQualityScore = mock(() => ({
      earsCoverage: 5,
      acceptanceCriteria: 5,
      constraintClarity: 5,
      testability: 5,
      ambiguityPenalty: 5,
      total: 15,
    }));

    await runGoalLoop({ sessionId, cardId, userId });

    expect(deps.detectCoveredCategories).toHaveBeenCalled();
  });

  it('updates quality_score on session after each turn', async () => {
    let turn = 0;
    deps.computeQualityScore = mock(() => {
      turn++;
      if (turn >= 3)
        return {
          earsCoverage: 22,
          acceptanceCriteria: 23,
          constraintClarity: 23,
          testability: 24,
          ambiguityPenalty: 2,
          total: 90,
        };
      return {
        earsCoverage: 15,
        acceptanceCriteria: 15,
        constraintClarity: 15,
        testability: 15,
        ambiguityPenalty: 5,
        total: 55,
      };
    });

    await runGoalLoop({ sessionId, cardId, userId });

    expect(deps.updateSession).toHaveBeenCalled();
    const lastCall = (deps.updateSession as ReturnType<typeof mock>).mock.calls[
      (deps.updateSession as ReturnType<typeof mock>).mock.calls.length - 1
    ]?.[1] as { quality_score?: number; status?: string } | undefined;
    expect(lastCall?.quality_score).toBe(90);
    expect(lastCall?.status).toBe('READY_FOR_REVIEW');
  });
});
