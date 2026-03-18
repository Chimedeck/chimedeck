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
  starBoard,
  unstarBoard,
  type Board,
} from '../../api';
import { deleteBoardOptimisticThunk } from '../../slices/boardsSlice';

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
  // Starred filter: when true, only starred boards are shown
  showStarredOnly: boolean;
  // Snapshot of boards array captured before an optimistic delete; null when idle.
  deleteSnapshot: Board[] | null;
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
  deleteSnapshot: null,
  showStarredOnly: false,
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

export const starBoardThunk = createAppAsyncThunk(
  'boardList/star',
  async ({ boardId }: { boardId: string }, { extra }) => {
    await starBoard({ api: extra.api, boardId });
    return boardId;
  },
);

export const unstarBoardThunk = createAppAsyncThunk(
  'boardList/unstar',
  async ({ boardId }: { boardId: string }, { extra }) => {
    await unstarBoard({ api: extra.api, boardId });
    return boardId;
  },
);

// ---------- Slice ----------

const boardListPageSlice = createSlice({
  name: 'boardListPage',
  initialState,
  reducers: {
    toggleStarredFilter(state) {
      state.showStarredOnly = !state.showStarredOnly;
    },
    // boardRemovedByRealtime handles board_deleted events arriving via the personal
    // WS channel for other users viewing the same workspace boards list.
    // [why] Also prunes the deleteSnapshot so a concurrent optimistic-delete rollback
    // does not restore a board that was genuinely deleted by another actor.
    boardRemovedByRealtime(state, action: PayloadAction<{ boardId: string }>) {
      const { boardId } = action.payload;
      state.boards = state.boards.filter((b) => b.id !== boardId);
      if (state.deleteSnapshot !== null) {
        state.deleteSnapshot = state.deleteSnapshot.filter((b) => b.id !== boardId);
      }
    },
  },
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
      })
      // Optimistic star toggle: flip isStarred immediately on success
      .addCase(starBoardThunk.fulfilled, (state, action: PayloadAction<string>) => {
        const board = state.boards.find((b) => b.id === action.payload);
        if (board) board.isStarred = true;
      })
      .addCase(unstarBoardThunk.fulfilled, (state, action: PayloadAction<string>) => {
        const board = state.boards.find((b) => b.id === action.payload);
        if (board) board.isStarred = false;
      })
      // Optimistic delete: remove board immediately and snapshot for rollback.
      .addCase(deleteBoardOptimisticThunk.pending, (state, action) => {
        state.deleteSnapshot = [...state.boards];
        state.boards = state.boards.filter((b) => b.id !== action.meta.arg.boardId);
        state.deleteInProgress = true;
        state.deleteError = null;
      })
      .addCase(deleteBoardOptimisticThunk.fulfilled, (state) => {
        state.deleteSnapshot = null;
        state.deleteInProgress = false;
      })
      // Rollback: restore boards from snapshot on API failure.
      .addCase(deleteBoardOptimisticThunk.rejected, (state, action) => {
        if (state.deleteSnapshot !== null) {
          state.boards = state.deleteSnapshot;
          state.deleteSnapshot = null;
        }
        state.deleteInProgress = false;
        state.deleteError = action.error;
      });
  },
});

export default boardListPageSlice.reducer;

export const { toggleStarredFilter, boardRemovedByRealtime } = boardListPageSlice.actions;
// Re-export so UI components only import from this single duck file.
export { deleteBoardOptimisticThunk } from '../../slices/boardsSlice';

// ---------- Selectors ----------

const selectBoardListPage = (state: RootState) =>
  (state as unknown as { boardListPage: BoardListPageState }).boardListPage;

export const boardsSelector = createSelector(selectBoardListPage, (s) => s.boards);
export const showStarredOnlySelector = createSelector(
  selectBoardListPage,
  (s) => s.showStarredOnly,
);
export const visibleBoardsSelector = createSelector(
  selectBoardListPage,
  (s) => (s.showStarredOnly ? s.boards.filter((b) => b.isStarred) : s.boards),
);
export const fetchBoardsInProgressSelector = createSelector(
  selectBoardListPage,
  (s) => s.fetchInProgress,
);
export const fetchBoardsErrorSelector = createSelector(
  selectBoardListPage,
  (s) => s.fetchError,
);
