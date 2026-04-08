// useBoardPlugins — thin hook wrapping the PluginDashboard duck selectors and dispatchers.
import { useCallback } from 'react';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  fetchBoardPluginsThunk,
  fetchAvailablePluginsThunk,
  fetchDiscoverablePluginsThunk,
  enablePluginThunk,
  disablePluginThunk,
  optimisticDisable,
  rollbackDisable,
  selectBoardPlugins,
  selectAvailablePlugins,
  selectPluginsStatus,
  selectPluginsError,
} from '../containers/PluginDashboardPage/PluginDashboardPage.duck';
import type { Plugin, BoardPlugin } from '../api';

export function useBoardPlugins({ boardId }: { boardId: string }) {
  const dispatch = useAppDispatch();
  const boardPlugins = useAppSelector(selectBoardPlugins);
  const availablePlugins = useAppSelector(selectAvailablePlugins);
  const status = useAppSelector(selectPluginsStatus);
  const error = useAppSelector(selectPluginsError);

  const loadPlugins = useCallback(() => {
    dispatch(fetchBoardPluginsThunk({ boardId })).then(() => {
      // [why] Use board-specific /available endpoint so the Discover list is pre-filtered
      dispatch(fetchDiscoverablePluginsThunk({ boardId }));
    });
  }, [dispatch, boardId]);

  const enablePlugin = useCallback(
    async (plugin: Plugin): Promise<{ error?: string } | void> => {
      // No optimistic update — enables can fail silently (e.g. 403) and the
      // snap of adding then rolling back is more jarring than a slight delay.
      const result = await dispatch(enablePluginThunk({ boardId, pluginId: plugin.id }));
      if (enablePluginThunk.rejected.match(result)) {
        // Return the error name so callers can surface it (e.g. 403 permission errors)
        return { error: (result.payload as string) ?? 'enable-plugin-failed' };
      }
    },
    [dispatch, boardId],
  );

  const disablePlugin = useCallback(
    async (boardPlugin: BoardPlugin) => {
      // Optimistic update before API call
      dispatch(optimisticDisable({ pluginId: boardPlugin.plugin.id }));
      const result = await dispatch(
        disablePluginThunk({ boardId, pluginId: boardPlugin.plugin.id }),
      );
      if (disablePluginThunk.rejected.match(result)) {
        // Rollback on failure
        dispatch(rollbackDisable({ boardPlugin }));
      }
    },
    [dispatch, boardId],
  );

  return { boardPlugins, availablePlugins, status, error, loadPlugins, enablePlugin, disablePlugin };
}
