// boardsSlice — optimistic board-deletion thunk and associated reducer actions.
// The boards array itself lives in boardListPage (BoardListPage.duck.ts); this slice
// exports the thunk that drives the optimistic flow so that boardListPage can react
// to it via extraReducers without duplicating state.
//
// Flow:
//   1. pending  → boardListPage snapshots current boards, removes board immediately
//   2. fulfilled → boardListPage clears the snapshot (delete confirmed)
//   3. rejected  → boardListPage restores boards from snapshot (rollback)
import { createAppAsyncThunk } from '~/utils/redux';
import { deleteBoard, type BoardDeleteConflictError } from '../api';

type DeleteApi = { delete: <T>(url: string, config?: { data?: unknown }) => Promise<T> };

// deleteBoardOptimisticThunk dispatches the HTTP DELETE and lets boardListPage
// handle optimistic state transitions via extraReducers.
export const deleteBoardOptimisticThunk = createAppAsyncThunk(
  'boards/deleteOptimistic',
  async (
    { boardId, confirm }: { boardId: string; confirm?: boolean },
    { extra },
  ): Promise<string> => {
    const { api } = extra as { api: DeleteApi };
    // Pass confirm only when explicitly true to satisfy exactOptionalPropertyTypes.
    await deleteBoard({ api, boardId, ...(confirm ? { confirm } : {}) });
    return boardId;
  },
);

// Re-export for type-safe error handling in the UI (e.g. 409 Conflict handling).
export type { BoardDeleteConflictError };
