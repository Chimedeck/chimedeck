// useWebSocket — React hook that manages the WebSocket connection lifecycle.
// Connects when the board page mounts, disconnects on unmount.
// On reconnect: fetches missed events since lastSequence, then replays queue.
//
// WHY: isolating connection lifecycle in a hook keeps BoardPage clean and
// makes testing straightforward (mock the socket singleton).
import { useEffect, useRef, useCallback, useState } from 'react';
import { socket } from '../client/socket';
import { messageQueue } from '../client/messageQueue';
import type { RealtimeEvent } from '../client/socket';

export interface UseWebSocketOptions {
  boardId: string;
  token: string;
  lastSequence: number;
  /** Called for each incoming WS event (dispatch Redux actions here) */
  onEvent: (event: RealtimeEvent) => void;
  /** Called when queue replay encounters a conflict (409/422) */
  onMutationConflict?: (mutationId: string) => void;
  /** Called when queue overflows (trigger full board reload) */
  onQueueOverflow?: (boardId: string) => void;
  /** API fetch function for re-sync after reconnect */
  fetchMissedEvents?: (boardId: string, since: number) => Promise<RealtimeEvent[]>;
}

export interface UseWebSocketResult {
  connected: boolean;
}

export function useWebSocket({
  boardId,
  token,
  lastSequence,
  onEvent,
  onMutationConflict,
  onQueueOverflow,
  fetchMissedEvents,
}: UseWebSocketOptions): UseWebSocketResult {
  const [connected, setConnected] = useState(false);
  const lastSeqRef = useRef(lastSequence);
  const isReplayingRef = useRef(false);

  // Keep lastSequence ref current so reconnect handler always uses latest value
  useEffect(() => {
    lastSeqRef.current = lastSequence;
  }, [lastSequence]);

  const replayQueue = useCallback(async () => {
    if (isReplayingRef.current) return;
    isReplayingRef.current = true;

    while (messageQueue.size() > 0) {
      const mutation = messageQueue.peek();
      if (!mutation) break;

      try {
        const response = await fetch(mutation.url, {
          method: mutation.method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: mutation.body !== undefined ? JSON.stringify(mutation.body) : undefined,
        });

        if (response.status === 409 || response.status === 422) {
          // Discard conflicted mutation and notify
          messageQueue.dequeue();
          onMutationConflict?.(mutation.id);
          continue;
        }

        if (!response.ok) {
          // Non-conflict server error — stop replay, leave remaining mutations
          break;
        }

        messageQueue.dequeue();
      } catch {
        // Network error during replay — stop and retry on next reconnect
        break;
      }
    }

    isReplayingRef.current = false;
  }, [token, onMutationConflict]);

  const handleOpen = useCallback(async () => {
    setConnected(true);

    // Re-sync missed events from server
    if (fetchMissedEvents) {
      try {
        const missed = await fetchMissedEvents(boardId, lastSeqRef.current);
        for (const ev of missed) {
          onEvent(ev);
        }
      } catch {
        // If re-sync fails, board state may be stale — caller can show a toast
      }
    }

    // Replay queued mutations in order
    await replayQueue();
  }, [boardId, fetchMissedEvents, onEvent, replayQueue]);

  const handleClose = useCallback(() => {
    setConnected(false);
  }, []);

  useEffect(() => {
    // Wire overflow handler so queue can trigger board reload
    if (onQueueOverflow) {
      messageQueue.setOverflowHandler(onQueueOverflow);
    }

    const unsubscribe = socket.subscribe({
      onEvent,
      onOpen: handleOpen,
      onClose: handleClose,
    });

    socket.connect({ boardId, token });

    return () => {
      unsubscribe();
      socket.disconnect();
    };
    // We intentionally only reconnect when boardId/token change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, token]);

  return { connected };
}
