// Redux slice for board view preference (Sprint 52).
// Manages which view type (KANBAN/TABLE/CALENDAR/TIMELINE) is active for the
// current board and syncs with the server-side user_board_view_prefs table.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppAsyncThunk } from '~/utils/redux';
import { getViewPreference, putViewPreference } from './api';
import { DEFAULT_VIEW } from './constants';
import type { ViewPreferenceState, ViewType } from './types';
import type { RootState } from '~/store';

const initialState: ViewPreferenceState = {
  activeView: DEFAULT_VIEW,
  status: 'idle',
};

// ── Thunks ──────────────────────────────────────────────────────────────────

export const fetchViewPreference = createAppAsyncThunk(
  'viewPreference/fetch',
  async ({ boardId }: { boardId: string }) => {
    const res = await getViewPreference({ boardId });
    return res.data.viewType;
  },
);

export const saveViewPreference = createAppAsyncThunk(
  'viewPreference/save',
  async ({ boardId, viewType }: { boardId: string; viewType: ViewType }) => {
    const res = await putViewPreference({ boardId, viewType });
    return res.data.viewType;
  },
);

// ── Slice ───────────────────────────────────────────────────────────────────

const viewPreferenceSlice = createSlice({
  name: 'viewPreference',
  initialState,
  reducers: {
    // Optimistic local update — used when switching tabs before the PUT resolves
    setActiveView(state, action: PayloadAction<ViewType>) {
      state.activeView = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchViewPreference.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchViewPreference.fulfilled, (state, action) => {
        state.activeView = action.payload ?? DEFAULT_VIEW;
        state.status = 'idle';
      })
      .addCase(fetchViewPreference.rejected, (state) => {
        // Keep current view, just mark idle — not fatal
        state.status = 'idle';
      })
      .addCase(saveViewPreference.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(saveViewPreference.fulfilled, (state, action) => {
        state.activeView = action.payload ?? state.activeView;
        state.status = 'idle';
      })
      .addCase(saveViewPreference.rejected, (state) => {
        state.status = 'idle';
      });
  },
});

export const { setActiveView } = viewPreferenceSlice.actions;
export default viewPreferenceSlice.reducer;

// ── Selectors ────────────────────────────────────────────────────────────────

export const selectActiveView = (state: RootState) => state.viewPreference.activeView;
export const selectViewPreferenceStatus = (state: RootState) => state.viewPreference.status;
