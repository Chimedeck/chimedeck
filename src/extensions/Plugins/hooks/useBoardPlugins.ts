// useBoardPlugins — thin hook wrapping the PluginDashboard duck selectors and dispatchers.
import { useCallback } from 'react';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  fetchBoardPluginsThunk,
  fetchAvailablePluginsThunk,
  enablePluginThunk,
  disablePluginThunk,
  optimisticEnable,
  optimisticDisable,
  rollbackEnable,
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
      dispatch(fetchAvailablePluginsThunk({ boardId }));
    });
  }, [dispatch, boardId]);

  const enablePlugin = useCallback(
    async (plugin: Plugin) => {
      // Optimistic update before API call
      dispatch(optimisticEnable({ plugin, boardId }));
      const result = await dispatch(enablePluginThunk({ boardId, pluginId: plugin.id }));
      if (enablePluginThunk.rejected.match(result)) {
        // Rollback on failure
        dispatch(rollbackEnable({ plugin }));
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
