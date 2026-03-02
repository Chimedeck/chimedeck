// listSlice — Redux slice for List entities with optimistic update support.
// Implements applyOptimistic / confirmOptimistic / rollbackOptimistic per sprint-10 spec.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { List } from './api';

// ---------- State ----------

export interface ListsState {
  byId: Record<string, List>;
  /** Ordered list IDs per board */
  orderByBoard: Record<string, string[]>;
  /** snapshot stored by mutationId for rollback */
  snapshots: Record<string, ListsState['byId']>;
}

const initialState: ListsState = {
  byId: {},
  orderByBoard: {},
  snapshots: {},
};

// ---------- Helpers ----------

function upsert(state: ListsState, list: List) {
  state.byId[list.id] = list;
  const boardOrder = state.orderByBoard[list.boardId] ?? [];
  if (!boardOrder.includes(list.id)) {
    boardOrder.push(list.id);
    state.orderByBoard[list.boardId] = boardOrder;
  }
}

// ---------- Slice ----------

const listSlice = createSlice({
  name: 'lists',
  initialState,
  reducers: {
    // ── Seed ────────────────────────────────────────────────────────────
    hydrate(state, action: PayloadAction<{ lists: List[]; boardId: string }>) {
      for (const list of action.payload.lists) {
        upsert(state, list);
      }
    },

    // ── Optimistic mutations ─────────────────────────────────────────────
    /** Apply an optimistic update; stores a snapshot for potential rollback */
    applyOptimistic(
      state,
      action: PayloadAction<{ mutationId: string; list: List }>,
    ) {
      const { mutationId, list } = action.payload;
      // Store snapshot before mutation
      state.snapshots[mutationId] = { ...state.byId };
      upsert(state, list);
    },

    /** Reconcile with the authoritative server response */
    confirmOptimistic(
      state,
      action: PayloadAction<{ mutationId: string; list: List }>,
    ) {
      const { mutationId, list } = action.payload;
      delete state.snapshots[mutationId];
      upsert(state, list);
    },

    /** Restore pre-mutation snapshot on failure */
    rollbackOptimistic(
      state,
      action: PayloadAction<{ mutationId: string }>,
    ) {
      const { mutationId } = action.payload;
      const snapshot = state.snapshots[mutationId];
      if (snapshot) {
        state.byId = snapshot;
        delete state.snapshots[mutationId];
      }
    },

    /** Optimistic reorder: update local order immediately */
    applyOptimisticReorder(
      state,
      action: PayloadAction<{ mutationId: string; boardId: string; orderedIds: string[] }>,
    ) {
      const { mutationId, boardId, orderedIds } = action.payload;
      state.snapshots[mutationId] = { ...state.byId };
      state.orderByBoard[boardId] = orderedIds;
    },

    rollbackOptimisticReorder(
      state,
      action: PayloadAction<{ mutationId: string; boardId: string; previousOrder: string[] }>,
    ) {
      const { mutationId, boardId, previousOrder } = action.payload;
      delete state.snapshots[mutationId];
      state.orderByBoard[boardId] = previousOrder;
    },

    // ── Remote (WS) events ───────────────────────────────────────────────
    remoteCreate(state, action: PayloadAction<{ list: List }>) {
      upsert(state, action.payload.list);
    },

    remoteUpdate(state, action: PayloadAction<{ list: List }>) {
      upsert(state, action.payload.list);
    },

    remoteArchive(state, action: PayloadAction<{ listId: string }>) {
      const list = state.byId[action.payload.listId];
      if (list) list.archived = true;
    },

    /** Server broadcasts authoritative positions after any reorder */
    remoteReorder(state, action: PayloadAction<{ boardId: string; lists: List[] }>) {
      const { boardId, lists } = action.payload;
      state.orderByBoard[boardId] = lists.map((l) => l.id);
      for (const list of lists) {
        state.byId[list.id] = list;
      }
    },
  },
});

export const listSliceActions = listSlice.actions;
export default listSlice.reducer;
