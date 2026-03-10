// Custom hook for board view preference.
// Handles load-on-mount and tab-switch persistence in one place.
import { useEffect, useCallback } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  fetchViewPreference,
  saveViewPreference,
  setActiveView,
  selectActiveView,
  selectViewPreferenceStatus,
} from './viewPreference.slice';
import type { ViewType } from './types';

export function useViewPreference({ boardId }: { boardId: string }) {
  const dispatch = useAppDispatch();
  const activeView = useAppSelector(selectActiveView);
  const status = useAppSelector(selectViewPreferenceStatus);

  // Load the persisted preference when the board mounts
  useEffect(() => {
    if (boardId) dispatch(fetchViewPreference({ boardId }));
  }, [dispatch, boardId]);

  const switchView = useCallback(
    (viewType: ViewType) => {
      // Optimistic local update so the UI responds immediately
      dispatch(setActiveView(viewType));
      dispatch(saveViewPreference({ boardId, viewType }));
    },
    [dispatch, boardId],
  );

  return { activeView, status, switchView };
}
