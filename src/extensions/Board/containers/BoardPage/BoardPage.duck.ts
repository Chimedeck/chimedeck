// Redux duck for BoardPage — single board state, RTK Query-style async thunk.
import {
  createSelector,
  createSlice,
  type PayloadAction,
  type SerializedError,
} from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import { getBoard, type Board } from '../../api';

// ---------- State ----------

interface BoardPageState {
  board: Board | null;
  includes: { lists: unknown[]; cards: unknown[] };
  fetchInProgress: boolean;
  fetchError: SerializedError | null;
}

const initialState: BoardPageState = {
  board: null,
  includes: { lists: [], cards: [] },
  fetchInProgress: false,
  fetchError: null,
};

// ---------- Thunks ----------

export const fetchBoardThunk = createAppAsyncThunk(
  'boardPage/fetch',
  async ({ boardId }: { boardId: string }, { extra }) => {
    return getBoard({ api: extra.api, boardId });
  },
);

// ---------- Slice ----------

const boardPageSlice = createSlice({
  name: 'boardPage',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoardThunk.pending, (state) => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(
        fetchBoardThunk.fulfilled,
        (
          state,
          action: PayloadAction<{ data: Board; includes: { lists: unknown[]; cards: unknown[] } }>,
        ) => {
          state.fetchInProgress = false;
          state.board = action.payload.data;
          state.includes = action.payload.includes;
        },
      )
      .addCase(fetchBoardThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.error;
      });
  },
});

export default boardPageSlice.reducer;

// ---------- Selectors ----------

const selectBoardPage = (state: RootState) =>
  (state as unknown as { boardPage: BoardPageState }).boardPage;

export const boardSelector = createSelector(selectBoardPage, (s) => s.board);
export const boardIncludesSelector = createSelector(selectBoardPage, (s) => s.includes);
export const fetchBoardInProgressSelector = createSelector(
  selectBoardPage,
  (s) => s.fetchInProgress,
);
export const fetchBoardErrorSelector = createSelector(selectBoardPage, (s) => s.fetchError);
