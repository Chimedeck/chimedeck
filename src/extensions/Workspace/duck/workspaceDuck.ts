// Global workspace duck — tracks the list of workspaces and which one is active.
// Used by the AppShell sidebar across all private pages.
import { createSelector, createSlice, type PayloadAction, type SerializedError } from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { listWorkspaces, createWorkspace, type Workspace } from '../api';

// ---------- State ----------

interface WorkspaceShellState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  status: 'idle' | 'loading' | 'error';
  createInProgress: boolean;
  createError: SerializedError | null;
}

const initialState: WorkspaceShellState = {
  workspaces: [],
  activeWorkspaceId: null,
  status: 'idle',
  createInProgress: false,
  createError: null,
};

// ---------- Thunks ----------

export const fetchWorkspacesThunk = createAppAsyncThunk(
  'workspaceShell/fetch',
  async (_, { extra: { api } }) => {
    const res = await listWorkspaces({ api });
    return res.data;
  }
);

export const createWorkspaceThunk = createAppAsyncThunk(
  'workspaceShell/create',
  async ({ name }: { name: string }, { extra: { api } }) => {
    const res = await createWorkspace({ api, name });
    return res.data;
  }
);

// ---------- Slice ----------

const workspaceShellSlice = createSlice({
  name: 'workspaceShell',
  initialState,
  reducers: {
    setActiveWorkspace(state, action: PayloadAction<string>) {
      state.activeWorkspaceId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkspacesThunk.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchWorkspacesThunk.fulfilled, (state, action) => {
        state.status = 'idle';
        state.workspaces = action.payload;
        // Default active workspace to first if not yet set
        if (!state.activeWorkspaceId && action.payload.length > 0) {
          state.activeWorkspaceId = action.payload[0].id;
        }
      })
      .addCase(fetchWorkspacesThunk.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(createWorkspaceThunk.pending, (state) => {
        state.createInProgress = true;
        state.createError = null;
      })
      .addCase(createWorkspaceThunk.fulfilled, (state, action) => {
        state.createInProgress = false;
        state.workspaces.push(action.payload);
        state.activeWorkspaceId = action.payload.id;
      })
      .addCase(createWorkspaceThunk.rejected, (state, action) => {
        state.createInProgress = false;
        state.createError = action.error;
      });
  },
});

export const { setActiveWorkspace } = workspaceShellSlice.actions;
export const workspaceShellReducer = workspaceShellSlice.reducer;

// ---------- Selectors ----------

const shellState = (state: RootState) => state.workspaceShell;

export const selectWorkspaces = createSelector(shellState, (s) => s.workspaces);
export const selectActiveWorkspaceId = createSelector(shellState, (s) => s.activeWorkspaceId);
export const selectWorkspacesStatus = createSelector(shellState, (s) => s.status);
export const selectActiveWorkspace = createSelector(
  shellState,
  (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
);
export const selectCreateWorkspaceInProgress = createSelector(shellState, (s) => s.createInProgress);
export const selectCreateWorkspaceError = createSelector(shellState, (s) => s.createError);
