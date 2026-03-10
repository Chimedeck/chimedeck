// usePollingFallback — polls GET /api/v1/boards/:id/events?since=<seq> every 5 s
// when WS is unavailable (active=true). Stops automatically when WS reconnects
// (caller sets active=false). Guards against duplicate events via sequence tracking
// so a mid-poll WS reconnect cannot double-apply an event.
import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '~/common/api/client';
import type { RealtimeEvent } from './client/socket';

const POLL_INTERVAL_MS = 5_000;

interface UsePollingFallbackOptions {
  boardId: string;
  /** When true polling is running; when false it stops */
  active: boolean;
  lastSequence: number;
  /** Called with each batch of new events from the server */
  onEvents: (events: RealtimeEvent[]) => void;
}

export function usePollingFallback({
  boardId,
  active,
  lastSequence,
  onEvents,
}: UsePollingFallbackOptions): void {
  const lastSeqRef = useRef(lastSequence);
  const activeRef = useRef(active);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which sequences we've already delivered to prevent race-condition
  // duplicates if WS reconnects while a poll is in flight.
  const deliveredRef = useRef<Set<number>>(new Set());

  useEffect(() => { lastSeqRef.current = lastSequence; }, [lastSequence]);
  useEffect(() => { activeRef.current = active; }, [active]);

  const poll = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      // apiClient response interceptor auto-unwraps to response.data
      const result = (await apiClient.get(
        `/boards/${boardId}/events?since=${lastSeqRef.current}`
      )) as { data: RealtimeEvent[]; metadata: { hasMore: boolean; latestSequence: string } };

      const events = result.data;
      if (!events || events.length === 0) return;

      // Deduplicate — filter events whose sequence we've already dispatched
      const fresh = events.filter((ev: RealtimeEvent) => {
        if (ev.sequence === undefined) return true;
        if (deliveredRef.current.has(ev.sequence)) return false;
        deliveredRef.current.add(ev.sequence);
        // Keep delivered set bounded
        if (deliveredRef.current.size > 2_000) deliveredRef.current.clear();
        return true;
      });

      if (fresh.length > 0) {
        lastSeqRef.current = Number(result.metadata.latestSequence);
        onEvents(fresh);
      }
    } catch {
      // Transient network error — silently retry next interval
    }
  }, [boardId, onEvents]);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fire an immediate poll then set up the recurring interval
    void poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, poll]);
}
