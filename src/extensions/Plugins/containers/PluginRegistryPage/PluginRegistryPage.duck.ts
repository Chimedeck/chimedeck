// Redux duck for PluginRegistryPage.
// Manages the global plugin registry list visible to platform admins.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppAsyncThunk } from '~/utils/redux';
import {
  fetchAvailablePlugins,
  registerPlugin as registerPluginApi,
  deletePlugin as deletePluginApi,
  reactivatePlugin as reactivatePluginApi,
  type Plugin,
  type RegisterPluginBody,
  type FetchAvailablePluginsParams,
} from '../../api';

// ---------- State ----------

export type RegistryStatus = 'active' | 'inactive' | 'all';

export interface PluginRegistryState {
  plugins: Plugin[];
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  deleteStatus: 'idle' | 'loading' | 'error';
  deleteError: string | null;
  reactivateStatus: 'idle' | 'loading' | 'error';
  reactivateError: string | null;
  searchQuery: string;
  selectedCategory: string | null;
  statusFilter: RegistryStatus;
}

const initialState: PluginRegistryState = {
  plugins: [],
  status: 'idle',
  error: null,
  deleteStatus: 'idle',
  deleteError: null,
  reactivateStatus: 'idle',
  reactivateError: null,
  searchQuery: '',
  selectedCategory: null,
  statusFilter: 'active',
};

// ---------- Thunks ----------

export const fetchPluginsThunk = createAppAsyncThunk(
  'pluginRegistry/fetchPlugins',
  async ({
    q,
    category,
    status,
  }: { q?: string; category?: string | null; status?: RegistryStatus } = {}) => {
    const params: FetchAvailablePluginsParams = {};
    if (q) params.q = q;
    if (category) params.category = category;
    // Pass isActive filter to the API when filtering by status
    if (status === 'active') params.isActive = true;
    if (status === 'inactive') params.isActive = false;
    return fetchAvailablePlugins(params);
  },
);

// [why] Returns the full plugin (including one-time apiKey) directly so the
// page can hand it straight to ApiKeyRevealModal without extra state management.
export const addPluginThunk = createAppAsyncThunk(
  'pluginRegistry/addPlugin',
  async ({ body }: { body: RegisterPluginBody }) => {
    return registerPluginApi(body);
  },
);

export const deletePluginThunk = createAppAsyncThunk(
  'pluginRegistry/deletePlugin',
  async ({ pluginId }: { pluginId: string }) => {
    return deletePluginApi({ pluginId });
  },
);

export const reactivatePluginThunk = createAppAsyncThunk(
  'pluginRegistry/reactivatePlugin',
  async ({ pluginId }: { pluginId: string }) => {
    return reactivatePluginApi({ pluginId });
  },
);

// ---------- Slice ----------

const pluginRegistrySlice = createSlice({
  name: 'pluginRegistry',
  initialState,
  reducers: {
    setRegistrySearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setRegistryCategory(state, action: PayloadAction<string | null>) {
      state.selectedCategory = action.payload;
    },
    setRegistryStatusFilter(state, action: PayloadAction<RegistryStatus>) {
      state.statusFilter = action.payload;
    },
    clearRegistryFilters(state) {
      state.searchQuery = '';
      state.selectedCategory = null;
      state.statusFilter = 'active';
    },
    clearDeleteState(state) {
      state.deleteStatus = 'idle';
      state.deleteError = null;
    },
    clearReactivateState(state) {
      state.reactivateStatus = 'idle';
      state.reactivateError = null;
    },
    // Optimistically remove a plugin from the list on deactivation
    optimisticRemovePlugin(state, action: PayloadAction<string>) {
      state.plugins = state.plugins.filter((p) => p.id !== action.payload);
    },
    // Add a newly registered plugin to the top of the list
    prependPlugin(state, action: PayloadAction<Plugin>) {
      state.plugins = [action.payload, ...state.plugins];
    },
    // Update a plugin in the list (after edit)
    updatePluginInList(state, action: PayloadAction<Plugin>) {
      const idx = state.plugins.findIndex((p) => p.id === action.payload.id);
      if (idx !== -1) state.plugins[idx] = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPluginsThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPluginsThunk.fulfilled, (state, action: PayloadAction<{ data: Plugin[] }>) => {
        state.status = 'idle';
        state.plugins = action.payload.data;
      })
      .addCase(fetchPluginsThunk.rejected, (state, action) => {
        state.status = 'error';
        state.error = (action.payload as string) ?? action.error.message ?? 'fetch-plugins-failed';
      })
      .addCase(deletePluginThunk.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deletePluginThunk.fulfilled, (state) => {
        state.deleteStatus = 'idle';
      })
      .addCase(deletePluginThunk.rejected, (state, action) => {
        state.deleteStatus = 'error';
        state.deleteError = (action.payload as string) ?? action.error.message ?? 'delete-plugin-failed';
      })
      .addCase(reactivatePluginThunk.pending, (state) => {
        state.reactivateStatus = 'loading';
        state.reactivateError = null;
      })
      .addCase(reactivatePluginThunk.fulfilled, (state, action: PayloadAction<{ data: Plugin }>) => {
        state.reactivateStatus = 'idle';
        // Update the plugin in the list if present
        const idx = state.plugins.findIndex((p) => p.id === action.payload.data.id);
        if (idx !== -1) state.plugins[idx] = action.payload.data;
      })
      .addCase(reactivatePluginThunk.rejected, (state, action) => {
        state.reactivateStatus = 'error';
        state.reactivateError =
          (action.payload as string) ?? action.error.message ?? 'reactivate-plugin-failed';
      });
  },
});

export const {
  setRegistrySearchQuery,
  setRegistryCategory,
  setRegistryStatusFilter,
  clearRegistryFilters,
  clearDeleteState,
  clearReactivateState,
  optimisticRemovePlugin,
  prependPlugin,
  updatePluginInList,
} = pluginRegistrySlice.actions;

export default pluginRegistrySlice.reducer;

// ---------- Selectors ----------

type StateWithRegistry = { pluginRegistry: PluginRegistryState };

export const selectRegistryPlugins = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.plugins;
export const selectRegistryStatus = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.status;
export const selectRegistryError = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.error;
export const selectRegistrySearchQuery = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.searchQuery;
export const selectRegistryCategory = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.selectedCategory;
export const selectRegistryStatusFilter = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.statusFilter;
export const selectDeleteStatus = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.deleteStatus;
export const selectDeleteError = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.deleteError;
export const selectReactivateStatus = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.reactivateStatus;
export const selectReactivateError = (state: unknown) =>
  (state as StateWithRegistry).pluginRegistry.reactivateError;
