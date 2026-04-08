// useHealthCheckProbe — per-row probe state management.
// Wraps the probeSingleThunk dispatch and exposes a simple `probe(id)` call
// alongside an `isProbing(id)` query so HealthCheckRow stays thin.

import { useCallback } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  probeSingleThunk,
  selectProbingIds,
} from '../containers/HealthCheckTab/HealthCheckTab.duck';

interface Options {
  boardId: string;
}

interface Result {
  /** Returns true while a probe is in-flight for the given healthCheckId. */
  isProbing: (healthCheckId: string) => boolean;
  /** Dispatches an on-demand probe for the given healthCheckId. */
  probe: (healthCheckId: string) => void;
}

/**
 * Convenience hook that provides probe dispatch and per-row probing state
 * for use in HealthCheckRow (or any component that needs it).
 *
 * Uses the full probingIds list from Redux so the `isProbing` predicate
 * can be called as a plain function without violating the Rules of Hooks.
 */
export function useHealthCheckProbe({ boardId }: Options): Result {
  const dispatch = useAppDispatch();
  // Subscribe once to the full set of in-flight probe IDs.
  const probingIds = useAppSelector(selectProbingIds);

  const probe = useCallback(
    (healthCheckId: string) => {
      dispatch(probeSingleThunk({ boardId, healthCheckId }));
    },
    [dispatch, boardId],
  );

  const isProbing = useCallback(
    (healthCheckId: string) => probingIds.includes(healthCheckId),
    [probingIds],
  );

  return { isProbing, probe };
}
