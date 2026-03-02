// Unit tests for wsMiddleware: optimistic → confirm → rollback cycle.
// Tests run with bun:test; no React DOM needed.
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { wsMiddleware, CONFIRM_SUFFIX, ROLLBACK_SUFFIX } from '../middleware/wsMiddleware';
import { socket } from '../client/socket';

// ---------- Helpers ----------

function makeStore(state: unknown = {}) {
  const dispatched: unknown[] = [];
  return {
    getState: () => state,
    dispatch: (a: unknown) => dispatched.push(a),
    dispatched,
  };
}

function makeNext() {
  const calls: unknown[] = [];
  const fn = (a: unknown) => { calls.push(a); return a; };
  return { fn, calls };
}

// Build a middleware chain and invoke it; returns dispatched array.
function invoke(action: unknown) {
  const dispatched: unknown[] = [];
  const storeAPI = {
    getState: () => ({}),
    dispatch: (a: unknown) => dispatched.push(a),
  };
  const next = makeNext();
  const chain = wsMiddleware(storeAPI as Parameters<typeof wsMiddleware>[0])(next.fn as Parameters<ReturnType<typeof wsMiddleware>>[0]);
  return { result: chain(action), next, dispatched };
}

// Simulate an open WebSocket so the middleware takes the HTTP path
function simulateConnected() {
  (socket as unknown as { ws: { readyState: number } }).ws = { readyState: WebSocket.OPEN };
}
function simulateDisconnected() {
  (socket as unknown as { ws: null }).ws = null;
}

// ---------- Tests ----------

describe('wsMiddleware', () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    simulateConnected();
  });

  afterEach(() => {
    simulateDisconnected();
  });

  it('passes non-optimistic actions straight through', async () => {
    const action = { type: 'some/action', payload: 'x' };
    const { next } = invoke(action);
    expect(next.calls).toContain(action);
  });

  it('lets optimistic action through to reducer immediately', async () => {
    const action = {
      type: 'cards/move',
      payload: { cardId: 'c1' },
      meta: {
        optimistic: true,
        mutationId: 'mut-1',
        snapshot: {},
        method: 'POST' as const,
        url: '/api/v1/cards/c1/move',
        body: { targetListId: 'l2' },
        boardId: 'b1',
      },
    };

    globalThis.fetch = mock(async () => new Response(JSON.stringify({ data: { id: 'c1' } }), { status: 200 })) as unknown as typeof fetch;

    const { next } = invoke(action);
    // Must reach next() synchronously (before HTTP resolves)
    expect(next.calls).toContain(action);
  });

  it('dispatches CONFIRM on 2xx response', async () => {
    const serverData = { data: { id: 'c1', list_id: 'l2' } };
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify(serverData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ) as unknown as typeof fetch;

    const action = {
      type: 'cards/move',
      payload: { cardId: 'c1' },
      meta: {
        optimistic: true,
        mutationId: 'mut-2',
        snapshot: { c1: { id: 'c1', list_id: 'l1' } },
        method: 'POST' as const,
        url: '/api/v1/cards/c1/move',
        body: { targetListId: 'l2' },
        boardId: 'b1',
      },
    };

    const { dispatched } = invoke(action);
    // Wait for async HTTP
    await new Promise((r) => setTimeout(r, 50));
    const confirmAction = (dispatched as { type: string }[]).find((a) => a.type === `cards/move${CONFIRM_SUFFIX}`);
    expect(confirmAction).toBeTruthy();
  });

  it('dispatches ROLLBACK on 4xx response', async () => {
    globalThis.fetch = mock(async () => new Response('Forbidden', { status: 403 })) as unknown as typeof fetch;

    const snapshot = { c1: { id: 'c1', list_id: 'l1' } };
    const action = {
      type: 'cards/move',
      payload: { cardId: 'c1' },
      meta: {
        optimistic: true,
        mutationId: 'mut-3',
        snapshot,
        method: 'POST' as const,
        url: '/api/v1/cards/c1/move',
        body: { targetListId: 'l2' },
        boardId: 'b1',
      },
    };

    const { dispatched } = invoke(action);
    await new Promise((r) => setTimeout(r, 50));
    const rollbackAction = (dispatched as { type: string; payload: { snapshot: unknown } }[]).find(
      (a) => a.type === `cards/move${ROLLBACK_SUFFIX}`,
    );
    expect(rollbackAction).toBeTruthy();
    expect(rollbackAction?.payload.snapshot).toEqual(snapshot);
  });

  it('dispatches ROLLBACK on network error', async () => {
    globalThis.fetch = mock(async () => { throw new Error('Network error'); }) as unknown as typeof fetch;

    const snapshot = { c1: { id: 'c1', list_id: 'l1' } };
    const action = {
      type: 'cards/move',
      payload: {},
      meta: {
        optimistic: true,
        mutationId: 'mut-4',
        snapshot,
        method: 'POST' as const,
        url: '/api/v1/cards/c1/move',
        boardId: 'b1',
      },
    };

    const { dispatched } = invoke(action);
    await new Promise((r) => setTimeout(r, 50));
    const rollbackAction = (dispatched as { type: string }[]).find(
      (a) => a.type === `cards/move${ROLLBACK_SUFFIX}`,
    );
    expect(rollbackAction).toBeTruthy();
  });
});
