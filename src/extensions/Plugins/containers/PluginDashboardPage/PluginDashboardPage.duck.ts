// Redux duck for PluginDashboardPage.
// Manages board plugins (active) and available plugins from the registry.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppAsyncThunk } from '~/utils/redux';
import {
  fetchBoardPlugins,
  fetchAvailablePlugins,
  enablePlugin as enablePluginApi,
  disablePlugin as disablePluginApi,
  type Plugin,
  type BoardPlugin,
} from '../../api';

// ---------- State ----------

export interface PluginsState {
  boardPlugins: BoardPlugin[];
  availablePlugins: Plugin[];
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

const initialState: PluginsState = {
  boardPlugins: [],
  availablePlugins: [],
  status: 'idle',
  error: null,
};

// ---------- Thunks ----------

export const fetchBoardPluginsThunk = createAppAsyncThunk(
  'plugins/fetchBoardPlugins',
  async ({ boardId }: { boardId: string }) => {
    return fetchBoardPlugins({ boardId });
  },
);

export const fetchAvailablePluginsThunk = createAppAsyncThunk(
  'plugins/fetchAvailablePlugins',
  async ({ boardId }: { boardId: string }) => {
    const result = await fetchAvailablePlugins();
    return { ...result, boardId };
  },
);

export const enablePluginThunk = createAppAsyncThunk(
  'plugins/enable',
  async ({ boardId, pluginId }: { boardId: string; pluginId: string }) => {
    return enablePluginApi({ boardId, pluginId });
  },
);

export const disablePluginThunk = createAppAsyncThunk(
  'plugins/disable',
  async ({ boardId, pluginId }: { boardId: string; pluginId: string }) => {
    return disablePluginApi({ boardId, pluginId });
  },
);

// ---------- Slice ----------

const pluginDashboardSlice = createSlice({
  name: 'pluginDashboard',
  initialState,
  reducers: {
    // Optimistic enable: move plugin from available → active
    optimisticEnable(state, action: PayloadAction<{ plugin: Plugin; boardId: string }>) {
      state.availablePlugins = state.availablePlugins.filter(
        (p) => p.id !== action.payload.plugin.id,
      );
      // Add a placeholder board plugin entry optimistically
      state.boardPlugins.push({
        id: `optimistic-${action.payload.plugin.id}`,
        boardId: action.payload.boardId,
        plugin: action.payload.plugin,
        enabledAt: new Date().toISOString(),
        disabledAt: null,
      });
    },
    // Optimistic disable: move plugin from active → available
    optimisticDisable(state, action: PayloadAction<{ pluginId: string }>) {
      const bp = state.boardPlugins.find((b) => b.plugin.id === action.payload.pluginId);
      if (bp) {
        state.boardPlugins = state.boardPlugins.filter(
          (b) => b.plugin.id !== action.payload.pluginId,
        );
        state.availablePlugins.push(bp.plugin);
      }
    },
    // Rollback: restore board plugin if enable failed
    rollbackEnable(state, action: PayloadAction<{ plugin: Plugin }>) {
      state.boardPlugins = state.boardPlugins.filter(
        (b) => b.plugin.id !== action.payload.plugin.id,
      );
      state.availablePlugins.push(action.payload.plugin);
    },
    // Rollback: restore active plugin if disable failed
    rollbackDisable(state, action: PayloadAction<{ boardPlugin: BoardPlugin }>) {
      state.availablePlugins = state.availablePlugins.filter(
        (p) => p.id !== action.payload.boardPlugin.plugin.id,
      );
      state.boardPlugins.push(action.payload.boardPlugin);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoardPluginsThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(
        fetchBoardPluginsThunk.fulfilled,
        (state, action: PayloadAction<{ data: BoardPlugin[] }>) => {
          state.status = 'idle';
          state.boardPlugins = action.payload.data;
        },
      )
      .addCase(fetchBoardPluginsThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message ?? 'Failed to load board plugins';
      })
      .addCase(
        fetchAvailablePluginsThunk.fulfilled,
        (
          state,
          action: PayloadAction<{ data: Plugin[]; boardId: string }>,
        ) => {
          // Filter out plugins already active on this board
          const activeIds = new Set(state.boardPlugins.map((b) => b.plugin.id));
          state.availablePlugins = action.payload.data.filter((p) => !activeIds.has(p.id));
        },
      )
      .addCase(
        enablePluginThunk.fulfilled,
        (state, action: PayloadAction<{ data: BoardPlugin }>) => {
          // Replace optimistic entry with real one from server
          state.boardPlugins = state.boardPlugins.filter(
            (b) =>
              b.plugin.id !== action.payload.data.plugin.id ||
              !b.id.startsWith('optimistic-'),
          );
          if (!state.boardPlugins.some((b) => b.plugin.id === action.payload.data.plugin.id)) {
            state.boardPlugins.push(action.payload.data);
          } else {
            // Update existing entry
            const idx = state.boardPlugins.findIndex(
              (b) => b.plugin.id === action.payload.data.plugin.id,
            );
            if (idx !== -1) state.boardPlugins[idx] = action.payload.data;
          }
        },
      )
      .addCase(
        disablePluginThunk.fulfilled,
        (_state, _action) => {
          // Optimistic update already handled; nothing extra needed
        },
      );
  },
});

export const {
  optimisticEnable,
  optimisticDisable,
  rollbackEnable,
  rollbackDisable,
} = pluginDashboardSlice.actions;

export default pluginDashboardSlice.reducer;

// ---------- Selectors ----------

type StateWithPlugins = { pluginDashboard: PluginsState };

export const selectBoardPlugins = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.boardPlugins;
export const selectAvailablePlugins = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.availablePlugins;
export const selectPluginsStatus = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.status;
export const selectPluginsError = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.error;
