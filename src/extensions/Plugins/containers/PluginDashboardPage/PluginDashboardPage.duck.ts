// Redux duck for PluginDashboardPage.
// Manages board plugins (active) and available plugins from the registry.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppAsyncThunk } from '~/utils/redux';
import {
  fetchBoardPlugins,
  fetchAvailablePlugins,
  fetchCategories,
  enablePlugin as enablePluginApi,
  disablePlugin as disablePluginApi,
  registerPlugin as registerPluginApi,
  updatePlugin as updatePluginApi,
  type FetchAvailablePluginsParams,
  type Plugin,
  type BoardPlugin,
  type RegisterPluginBody,
  type UpdatePluginBody,
} from '../../api';

// ---------- State ----------

export interface PluginsState {
  boardPlugins: BoardPlugin[];
  availablePlugins: Plugin[];
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  registerStatus: 'idle' | 'loading' | 'error' | 'success';
  registerError: string | null;
  newApiKey: string | null;
  searchQuery: string;
  selectedCategory: string | null;
  categories: string[];
  updateStatus: 'idle' | 'loading' | 'error' | 'success';
  updateError: string | null;
}

const initialState: PluginsState = {
  boardPlugins: [],
  availablePlugins: [],
  status: 'idle',
  error: null,
  registerStatus: 'idle',
  registerError: null,
  newApiKey: null,
  searchQuery: '',
  selectedCategory: null,
  categories: [],
  updateStatus: 'idle',
  updateError: null,
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
  async ({
    boardId,
    q,
    category,
    page,
    perPage,
  }: {
    boardId: string;
    q?: string;
    category?: string | null;
    page?: number;
    perPage?: number;
  }) => {
    const params: FetchAvailablePluginsParams = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (page != null) params.page = page;
    if (perPage != null) params.perPage = perPage;
    const result = await fetchAvailablePlugins(params);
    return { ...result, boardId };
  },
);

export const fetchCategoriesThunk = createAppAsyncThunk(
  'plugins/fetchCategories',
  async () => {
    return fetchCategories();
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

export const registerPluginThunk = createAppAsyncThunk(
  'plugins/register',
  async (body: RegisterPluginBody, { rejectWithValue }) => {
    try {
      return await registerPluginApi(body);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { name?: string } } };
      const name = e?.response?.data?.name ?? 'register-plugin-failed';
      return rejectWithValue(name);
    }
  },
);

export const updatePluginThunk = createAppAsyncThunk(
  'plugins/update',
  async ({ pluginId, body }: { pluginId: string; body: UpdatePluginBody }, { rejectWithValue }) => {
    try {
      return await updatePluginApi({ pluginId, body });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { name?: string } } };
      const name = e?.response?.data?.name ?? 'update-plugin-failed';
      return rejectWithValue(name);
    }
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
    // Clear registration state (after ApiKeyRevealModal is dismissed)
    clearRegisterState(state) {
      state.registerStatus = 'idle';
      state.registerError = null;
      state.newApiKey = null;
    },
    // Clear update state (after EditPluginModal is closed)
    clearUpdateState(state) {
      state.updateStatus = 'idle';
      state.updateError = null;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setSelectedCategory(state, action: PayloadAction<string | null>) {
      state.selectedCategory = action.payload;
    },
    clearSearch(state) {
      state.searchQuery = '';
      state.selectedCategory = null;
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
      )
      .addCase(registerPluginThunk.pending, (state) => {
        state.registerStatus = 'loading';
        state.registerError = null;
        state.newApiKey = null;
      })
      .addCase(
        registerPluginThunk.fulfilled,
        (state, action: PayloadAction<{ data: Plugin & { apiKey: string } }>) => {
          state.registerStatus = 'success';
          state.newApiKey = action.payload.data.apiKey;
          // The new plugin will be loaded via a re-fetch of available plugins
        },
      )
      .addCase(registerPluginThunk.rejected, (state, action) => {
        state.registerStatus = 'error';
        state.registerError = (action.payload as string) ?? action.error.message ?? 'register-plugin-failed';
      })
      .addCase(
        fetchCategoriesThunk.fulfilled,
        (state, action: PayloadAction<{ data: string[] }>) => {
          state.categories = action.payload.data;
        },
      )
      .addCase(updatePluginThunk.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(
        updatePluginThunk.fulfilled,
        (state, action: PayloadAction<{ data: Plugin }>) => {
          state.updateStatus = 'success';
          const updated = action.payload.data;
          // Update in availablePlugins list
          const avIdx = state.availablePlugins.findIndex((p) => p.id === updated.id);
          if (avIdx !== -1) state.availablePlugins[avIdx] = updated;
          // Update in boardPlugins list
          state.boardPlugins = state.boardPlugins.map((bp) =>
            bp.plugin.id === updated.id ? { ...bp, plugin: updated } : bp,
          );
        },
      )
      .addCase(updatePluginThunk.rejected, (state, action) => {
        state.updateStatus = 'error';
        state.updateError = (action.payload as string) ?? action.error.message ?? 'update-plugin-failed';
      });
  },
});

export const {
  optimisticEnable,
  optimisticDisable,
  rollbackEnable,
  rollbackDisable,
  clearRegisterState,
  clearUpdateState,
  setSearchQuery,
  setSelectedCategory,
  clearSearch,
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
export const selectRegisterStatus = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.registerStatus;
export const selectRegisterError = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.registerError;
export const selectNewApiKey = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.newApiKey;
export const selectSearchQuery = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.searchQuery;
export const selectSelectedCategory = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.selectedCategory;
export const selectCategories = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.categories;
export const selectUpdateStatus = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.updateStatus;
export const selectUpdateError = (state: unknown) =>
  (state as StateWithPlugins).pluginDashboard.updateError;
