// Redux duck for BoardListPage — board list actions, thunks, reducers, selectors.
import {
  createSelector,
  createSlice,
  type PayloadAction,
  type SerializedError,
} from '@reduxjs/toolkit';
import type { RootState } from '~/store';
import { createAppAsyncThunk } from '~/utils/redux';
import {
  listBoards,
  createBoard,
  archiveBoard,
  deleteBoard,
  duplicateBoard,
  type Board,
} from '../../api';

// ---------- State ----------

interface BoardListPageState {
  boards: Board[];
  fetchInProgress: boolean;
  fetchError: SerializedError | null;
  createInProgress: boolean;
  createError: SerializedError | null;
  archiveInProgress: boolean;
  archiveError: SerializedError | null;
  deleteInProgress: boolean;
  deleteError: SerializedError | null;
  duplicateInProgress: boolean;
  duplicateError: SerializedError | null;
}

const initialState: BoardListPageState = {
  boards: [],
  fetchInProgress: false,
  fetchError: null,
  createInProgress: false,
  createError: null,
  archiveInProgress: false,
  archiveError: null,
  deleteInProgress: false,
  deleteError: null,
  duplicateInProgress: false,
  duplicateError: null,
};

// ---------- Thunks ----------

export const fetchBoardsThunk = createAppAsyncThunk(
  'boardList/fetch',
  async ({ workspaceId }: { workspaceId: string }, { extra }) => {
    const res = await listBoards({ api: extra.api, workspaceId });
    return res.data;
  },
);

export const createBoardThunk = createAppAsyncThunk(
  'boardList/create',
  async ({ workspaceId, title }: { workspaceId: string; title: string }, { extra }) => {
    const res = await createBoard({ api: extra.api, workspaceId, title });
    return res.data;
  },
);

export const archiveBoardThunk = createAppAsyncThunk(
  'boardList/archive',
  async ({ boardId }: { boardId: string }, { extra }) => {
    const res = await archiveBoard({ api: extra.api, boardId });
    return res.data;
  },
);

export const deleteBoardThunk = createAppAsyncThunk(
  'boardList/delete',
  async ({ boardId }: { boardId: string }, { extra }) => {
    await deleteBoard({ api: extra.api, boardId });
    return boardId;
  },
);

export const duplicateBoardThunk = createAppAsyncThunk(
  'boardList/duplicate',
  async ({ boardId }: { boardId: string }, { extra }) => {
    const res = await duplicateBoard({ api: extra.api, boardId });
    return res.data;
  },
);

// ---------- Slice ----------

const boardListPageSlice = createSlice({
  name: 'boardListPage',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoardsThunk.pending, (state) => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchBoardsThunk.fulfilled, (state, action: PayloadAction<Board[]>) => {
        state.fetchInProgress = false;
        state.boards = action.payload;
      })
      .addCase(fetchBoardsThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.error;
      })
      .addCase(createBoardThunk.pending, (state) => {
        state.createInProgress = true;
        state.createError = null;
      })
      .addCase(createBoardThunk.fulfilled, (state, action: PayloadAction<Board>) => {
        state.createInProgress = false;
        state.boards.push(action.payload);
      })
      .addCase(createBoardThunk.rejected, (state, action) => {
        state.createInProgress = false;
        state.createError = action.error;
      })
      .addCase(archiveBoardThunk.fulfilled, (state, action: PayloadAction<Board>) => {
        const idx = state.boards.findIndex((b) => b.id === action.payload.id);
        if (idx !== -1) state.boards[idx] = action.payload;
      })
      .addCase(deleteBoardThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.boards = state.boards.filter((b) => b.id !== action.payload);
      })
      .addCase(duplicateBoardThunk.fulfilled, (state, action: PayloadAction<Board>) => {
        state.duplicateInProgress = false;
        state.boards.push(action.payload);
      });
  },
});

export default boardListPageSlice.reducer;

// ---------- Selectors ----------

const selectBoardListPage = (state: RootState) =>
  (state as unknown as { boardListPage: BoardListPageState }).boardListPage;

export const boardsSelector = createSelector(selectBoardListPage, (s) => s.boards);
export const fetchBoardsInProgressSelector = createSelector(
  selectBoardListPage,
  (s) => s.fetchInProgress,
);
export const fetchBoardsErrorSelector = createSelector(
  selectBoardListPage,
  (s) => s.fetchError,
);
