// useBoardSync — subscribes to incoming WS events for a board and dispatches
// Redux actions to reconcile remote changes.
//
// WHY: kept separate from useWebSocket so the dispatch logic can be tested
// in isolation without needing a live WebSocket.
import { useCallback, useRef } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import type { RealtimeEvent } from '../client/socket';
import { listSliceActions } from '../../List/listSlice';
import { cardSliceActions } from '../../Card/cardSlice';

export interface UseBoardSyncOptions {
  boardId: string;
}

export interface UseBoardSyncResult {
  /** Pass this to useWebSocket's onEvent */
  handleEvent: (event: RealtimeEvent) => void;
  /** Last seen server sequence number (for re-sync after reconnect) */
  lastSequence: number;
}

export function useBoardSync({ boardId }: UseBoardSyncOptions): UseBoardSyncResult {
  const dispatch = useAppDispatch();
  // Deduplication set: "entityId:sequence" → prevent double-apply
  const seen = useRef<Set<string>>(new Set());
  const lastSeqRef = useRef(0);

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      const { type, sequence, payload } = event;
      if (!payload) return;

      // Deduplication: skip events we've already applied
      if (sequence !== undefined) {
        const dedupeKey = `${type}:${sequence}`;
        if (seen.current.has(dedupeKey)) return;
        seen.current.add(dedupeKey);
        // Keep set bounded to avoid unbounded growth
        if (seen.current.size > 2_000) seen.current.clear();
        lastSeqRef.current = Math.max(lastSeqRef.current, sequence);
      }

      switch (type) {
        // ── List events ──────────────────────────────────────────────────
        case 'list_created':
          dispatch(listSliceActions.remoteCreate(payload as Parameters<typeof listSliceActions.remoteCreate>[0]));
          break;
        case 'list_updated':
          dispatch(listSliceActions.remoteUpdate(payload as Parameters<typeof listSliceActions.remoteUpdate>[0]));
          break;
        case 'list_archived':
          dispatch(listSliceActions.remoteArchive(payload as Parameters<typeof listSliceActions.remoteArchive>[0]));
          break;
        case 'list_reordered':
          // Server sends authoritative positions array; replace entirely
          dispatch(listSliceActions.remoteReorder(payload as Parameters<typeof listSliceActions.remoteReorder>[0]));
          break;

        // ── Card events ──────────────────────────────────────────────────
        case 'card_created':
          dispatch(cardSliceActions.remoteCreate(payload as Parameters<typeof cardSliceActions.remoteCreate>[0]));
          break;
        case 'card_updated':
          dispatch(cardSliceActions.remoteUpdate(payload as Parameters<typeof cardSliceActions.remoteUpdate>[0]));
          break;
        case 'card_moved':
          dispatch(cardSliceActions.remoteMove(payload as Parameters<typeof cardSliceActions.remoteMove>[0]));
          break;
        case 'card_archived':
          dispatch(cardSliceActions.remoteArchive(payload as Parameters<typeof cardSliceActions.remoteArchive>[0]));
          break;

        // ── Presence events ───────────────────────────────────────────────
        case 'presence_update':
          // Presence is handled by the PresenceAvatars component via its own
          // local state; nothing to dispatch to the entity slices.
          break;

        default:
          // Unknown event type — ignore
          break;
      }

      // Notify wsMiddleware that this sequence is confirmed via WS
      // (prevents double-confirmation when HTTP response arrives later)
      if (sequence !== undefined) {
        dispatch({ type: 'realtime/wsConfirmed', payload: { type, sequence, boardId } });
      }
    },
    [dispatch, boardId],
  );

  return { handleEvent, lastSequence: lastSeqRef.current };
}
