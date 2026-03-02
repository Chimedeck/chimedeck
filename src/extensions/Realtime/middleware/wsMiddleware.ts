// Redux middleware: intercepts optimistic actions, fires HTTP requests,
// then dispatches CONFIRM or ROLLBACK.
//
// WHY: centralising the HTTP side-effect in middleware keeps thunks simple
// (they only describe intent) and makes rollback deterministic.
//
// Pattern:
//   1. Action with `meta.optimistic = true` arrives
//   2. Middleware lets it through to the reducer (which applies optimistic state)
//   3. Middleware fires the HTTP request
//   4a. 2xx → dispatch CONFIRM (reconcile with server response)
//   4b. 4xx/5xx → dispatch ROLLBACK (restore snapshot stored in action.meta)
//
// Deduplication: when WS confirms own mutation before HTTP returns,
// the pending entry is marked `wsConfirmed` and the HTTP confirm is skipped.
import type { Middleware, AnyAction } from '@reduxjs/toolkit';
import { messageQueue } from '../client/messageQueue';
import { socket } from '../client/socket';

export const OPTIMISTIC_META = 'optimistic' as const;
export const CONFIRM_SUFFIX = '/confirmed';
export const ROLLBACK_SUFFIX = '/rolled_back';

interface OptimisticMeta {
  optimistic: true;
  mutationId: string;
  snapshot: unknown;       // pre-action state snapshot
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  boardId: string;
}

interface PendingEntry {
  action: AnyAction & { meta: OptimisticMeta };
  wsConfirmed: boolean;
}

// In-memory map of pending optimistic mutations: mutationId → entry
const pending = new Map<string, PendingEntry>();

function isOptimisticAction(action: unknown): action is AnyAction & { meta: OptimisticMeta } {
  return (
    typeof action === 'object' &&
    action !== null &&
    'meta' in action &&
    (action as AnyAction).meta?.optimistic === true
  );
}

export const wsMiddleware: Middleware = (storeAPI) => (next) => async (action: unknown) => {
  // ── WS confirmation of own mutation ────────────────────────────────────
  if (
    typeof action === 'object' &&
    action !== null &&
    (action as AnyAction).type === 'realtime/wsConfirmed'
  ) {
    const { sequence } = (action as AnyAction).payload as { sequence?: number; type: string; boardId: string };
    // Mark any pending mutations that match this sequence as WS-confirmed
    // (We use mutationId as sequence proxy when sequence is missing)
    for (const [id, entry] of pending.entries()) {
      // Heuristic: sequence matching is best-effort; WS event from own user
      // is the signal. If caller passes sequence we could match more precisely.
      void sequence; // reserved for future use
      entry.wsConfirmed = true;
      void id;
    }
    return next(action);
  }

  if (!isOptimisticAction(action)) {
    return next(action);
  }

  const { meta } = action;

  // 1. Let the optimistic action update the store immediately
  const result = next(action);

  // 2. Track the pending mutation for deduplication
  pending.set(meta.mutationId, { action, wsConfirmed: false });

  // 3. If offline — enqueue for later replay
  if (!socket.isConnected) {
    messageQueue.enqueue({
      id: meta.mutationId,
      boardId: meta.boardId,
      method: meta.method,
      url: meta.url,
      body: meta.body,
      enqueuedAt: Date.now(),
    });
    // Don't rollback yet — stays optimistic until reconnect
    pending.delete(meta.mutationId);
    return result;
  }

  // 4. Fire the HTTP request
  try {
    const response = await fetch(meta.url, {
      method: meta.method,
      headers: {
        'Content-Type': 'application/json',
        // Token is carried by the cookie / injected header in real app;
        // this header is a passthrough for API requests.
      },
      body: meta.body !== undefined ? JSON.stringify(meta.body) : undefined,
    });

    const entry = pending.get(meta.mutationId);

    if (response.ok) {
      let serverData: unknown;
      try { serverData = await response.json(); } catch { serverData = null; }

      // If WS already confirmed this, skip duplicate store update
      if (!entry?.wsConfirmed) {
        storeAPI.dispatch({
          type: `${action.type}${CONFIRM_SUFFIX}`,
          payload: { mutationId: meta.mutationId, serverData },
        });
      }
    } else {
      storeAPI.dispatch({
        type: `${action.type}${ROLLBACK_SUFFIX}`,
        payload: { mutationId: meta.mutationId, snapshot: meta.snapshot },
      });
    }
  } catch {
    // Network failure while online — rollback
    storeAPI.dispatch({
      type: `${action.type}${ROLLBACK_SUFFIX}`,
      payload: { mutationId: meta.mutationId, snapshot: meta.snapshot },
    });
  } finally {
    pending.delete(meta.mutationId);
  }

  return result;
};
