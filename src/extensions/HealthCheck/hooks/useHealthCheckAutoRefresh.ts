// useHealthCheckAutoRefresh — drives the 60-second auto-refresh cycle.
// Features:
//   - Calls the provided `onRefresh` callback every POLL_INTERVAL_MS.
//   - Pauses the countdown and refresh when the browser tab is not visible
//     (Page Visibility API) to avoid pointless background traffic.
//   - Exposes `secondsUntilRefresh` for the countdown display in HealthCheckCountdown.
//   - Resets the countdown whenever `onRefresh` is called (manual or auto).

import { useCallback, useEffect, useRef, useState } from 'react';
import { HEALTH_CHECK_POLL_INTERVAL_MS } from '../config/healthCheckConfig';

const TICK_MS = 1_000;
const TOTAL_SECONDS = Math.round(HEALTH_CHECK_POLL_INTERVAL_MS / TICK_MS);

interface Options {
  /** Called on every automatic refresh and when the caller invokes `triggerRefresh`. */
  onRefresh: () => void;
  /** When false the hook is inert (e.g. feature flag disabled). Defaults to true. */
  enabled?: boolean;
}

interface Result {
  /** Seconds remaining until the next automatic refresh. */
  secondsUntilRefresh: number;
  /** Resets the countdown and immediately calls onRefresh. */
  triggerRefresh: () => void;
}

/**
 * Manages the 60-second auto-refresh countdown for the Health Check tab.
 * Respects the Page Visibility API so it pauses when the tab is backgrounded.
 */
export function useHealthCheckAutoRefresh({ onRefresh, enabled = true }: Options): Result {
  const [secondsUntilRefresh, setSeconds] = useState(TOTAL_SECONDS);
  // Keep a stable ref to onRefresh so the interval never needs to re-register.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Track page visibility to pause when backgrounded.
  const isVisibleRef = useRef(!document.hidden);
  useEffect(() => {
    function handleVisibilityChange() {
      isVisibleRef.current = !document.hidden;
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Ref-based countdown so we can reset from triggerRefresh without
  // tearing down the interval.
  const remainingRef = useRef(TOTAL_SECONDS);

  const doRefresh = useCallback(() => {
    remainingRef.current = TOTAL_SECONDS;
    setSeconds(TOTAL_SECONDS);
    onRefreshRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      if (!isVisibleRef.current) return; // paused while tab is hidden

      remainingRef.current -= 1;
      setSeconds(remainingRef.current);

      if (remainingRef.current <= 0) {
        doRefresh();
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [enabled, doRefresh]);

  const triggerRefresh = useCallback(() => {
    doRefresh();
  }, [doRefresh]);

  return { secondsUntilRefresh: enabled ? secondsUntilRefresh : 0, triggerRefresh };
}
