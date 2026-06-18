import { beforeEach, describe, expect, it, mock } from 'bun:test';

let stateTransitionsEnabled = true;
let visibilityError: Response | null = null;
let resolvedBoardId: string | null = 'board-1';
const getCalls: string[] = [];
const putCalls: string[] = [];
const rulesCalls: string[] = [];

mock.module('../../../../config/featureFlags', () => ({
  featureFlags: {
    get STATE_TRANSITIONS_ENABLED() {
      return stateTransitionsEnabled;
    },
  },
}));

mock.module('../../../../middlewares/boardVisibility', () => ({
  applyBoardVisibility: async () => visibilityError,
}));

mock.module('../../../../common/ids/resolveEntityId', () => ({
  resolveBoardId: async () => resolvedBoardId,
}));

mock.module('../get', () => ({
  handleGetStateTransitions: async (_req: Request, boardId: string) => {
    getCalls.push(boardId);
    return Response.json({ data: { boardId } }, { status: 200 });
  },
}));

mock.module('../put', () => ({
  handlePutStateTransitions: async (_req: Request, boardId: string) => {
    putCalls.push(boardId);
    return Response.json({ data: { boardId } }, { status: 200 });
  },
}));

mock.module('../getRules', () => ({
  handleGetStateTransitionRules: async (_req: Request, boardId: string) => {
    rulesCalls.push(boardId);
    return Response.json({ data: { boardId, rules: [] } }, { status: 200 });
  },
}));

const { stateTransitionsRouter } = await import('../index');

beforeEach(() => {
  stateTransitionsEnabled = true;
  visibilityError = null;
  resolvedBoardId = 'board-1';
  getCalls.length = 0;
  putCalls.length = 0;
  rulesCalls.length = 0;
});

describe('stateTransitionsRouter', () => {
  it('returns null for unrelated paths', async () => {
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/workspaces/ws-1', { method: 'GET' }),
      '/api/v1/workspaces/ws-1'
    );
    expect(res).toBeNull();
  });

  it('returns 501 when the feature flag is disabled', async () => {
    stateTransitionsEnabled = false;
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      '/api/v1/boards/board-1/state-transitions'
    );

    expect(res?.status).toBe(501);
    const body = (await res?.json()) as { name: string };
    expect(body.name).toBe('not-implemented');
  });

  it('returns 404 when board id cannot be resolved', async () => {
    resolvedBoardId = null;
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/boards/not-found/state-transitions', { method: 'GET' }),
      '/api/v1/boards/not-found/state-transitions'
    );

    expect(res?.status).toBe(404);
    const body = (await res?.json()) as { name: string };
    expect(body.name).toBe('board-not-found');
  });

  it('returns board visibility error when access is denied', async () => {
    visibilityError = Response.json(
      { name: 'forbidden', data: { message: 'no board access' } },
      { status: 403 }
    );
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      '/api/v1/boards/board-1/state-transitions'
    );

    expect(res?.status).toBe(403);
  });

  it('routes GET base endpoint', async () => {
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'GET' }),
      '/api/v1/boards/board-1/state-transitions'
    );

    expect(res?.status).toBe(200);
    expect(getCalls).toEqual(['board-1']);
    expect(putCalls).toEqual([]);
    expect(rulesCalls).toEqual([]);
  });

  it('routes PUT base endpoint', async () => {
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions', { method: 'PUT' }),
      '/api/v1/boards/board-1/state-transitions'
    );

    expect(res?.status).toBe(200);
    expect(putCalls).toEqual(['board-1']);
    expect(getCalls).toEqual([]);
    expect(rulesCalls).toEqual([]);
  });

  it('routes GET rules endpoint', async () => {
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', {
        method: 'GET',
      }),
      '/api/v1/boards/board-1/state-transitions/rules'
    );

    expect(res?.status).toBe(200);
    expect(rulesCalls).toEqual(['board-1']);
    expect(getCalls).toEqual([]);
    expect(putCalls).toEqual([]);
  });

  it('returns null for unsupported methods on matched routes', async () => {
    const res = await stateTransitionsRouter(
      new Request('http://localhost/api/v1/boards/board-1/state-transitions/rules', {
        method: 'PUT',
      }),
      '/api/v1/boards/board-1/state-transitions/rules'
    );
    expect(res).toBeNull();
  });
});
