// boardSlice — full kanban board state: board, lists, cards, and optimistic drag support.
// Sprint 18: provides { board, listOrder, lists, cardsByList, cards, status }.
import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import { createAppAsyncThunk } from '~/utils/redux';
import { getBoard, listCardsByListBatch, type Board, type ListCardHydration } from '../api';
import type { List } from '../../List/api';
import type { ListSortBy } from '../../List/types';
import type { Card } from '../../Card/api';

const INITIAL_CARDS_PER_LIST = 50;
const DEFAULT_HYDRATION_BATCH_SIZE = 50;

// ---------- State ----------

export interface BoardState {
  board: Board | null;
  listOrder: string[];
  lists: Record<string, List>;
  cardsByList: Record<string, string[]>; // listId → ordered card IDs
  cards: Record<string, Card>;
  status: 'idle' | 'loading' | 'error';
  listHydration: Record<string, ListCardHydration & { loading: boolean; error: boolean }>;
  /** Snapshot taken at drag-start; used for rollback on API failure */
  dragSnapshot: {
    listOrder: string[];
    cardsByList: Record<string, string[]>;
  } | null;
}

const initialState: BoardState = {
  board: null,
  listOrder: [],
  lists: {},
  cardsByList: {},
  cards: {},
  status: 'idle',
  listHydration: {},
  dragSnapshot: null,
};

// ---------- Thunks ----------

export const fetchBoardDataThunk = createAppAsyncThunk(
  'board/fetchData',
  async (
    {
      boardId,
      initialCardsPerList,
    }: { boardId: string; initialCardsPerList?: number },
    { extra },
  ) => {
    return getBoard({
      api: (extra as { api: { get: <T>(url: string) => Promise<T> } }).api,
      boardId,
      initialCardsPerList:
        typeof initialCardsPerList === 'number' && initialCardsPerList > 0
          ? initialCardsPerList
          : INITIAL_CARDS_PER_LIST,
    });
  },
);

export const fetchListCardsBatchThunk = createAppAsyncThunk(
  'board/fetchListCardsBatch',
  async (
    {
      listId,
      limit = DEFAULT_HYDRATION_BATCH_SIZE,
      offset,
    }: { listId: string; limit?: number; offset: number },
    { extra },
  ) => {
    const response = await listCardsByListBatch({
      api: (extra as { api: { get: <T>(url: string) => Promise<T> } }).api,
      listId,
      limit,
      offset,
    });

    return {
      listId,
      data: response.data as Card[],
      metadata: response.metadata,
    };
  },
);

// ---------- Slice ----------

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    /** Save state snapshot before drag begins; enables rollback on failure */
    saveDragSnapshot(state) {
      state.dragSnapshot = {
        listOrder: [...state.listOrder],
        cardsByList: Object.fromEntries(
          Object.entries(state.cardsByList).map(([k, v]) => [k, [...v]]),
        ),
      };
    },

    clearDragSnapshot(state) {
      state.dragSnapshot = null;
    },

    /** Restore pre-drag snapshot; called after a failed API request */
    rollbackDrag(state) {
      if (state.dragSnapshot) {
        state.listOrder = state.dragSnapshot.listOrder;
        state.cardsByList = state.dragSnapshot.cardsByList;
        // [why] Avoid cloning the full cards map on drag-start (hot path).
        // Reconcile card.list_id from the rolled-back cardsByList only when
        // rollback happens, which is the uncommon failure path.
        for (const [listId, cardIds] of Object.entries(state.cardsByList)) {
          for (const cardId of cardIds) {
            const card = state.cards[cardId];
            if (card && card.list_id !== listId) {
              card.list_id = listId;
            }
          }
        }
        state.dragSnapshot = null;
      }
    },

    /** Move a card optimistically before the API responds */
    applyOptimisticCardMove(
      state,
      action: PayloadAction<{
        cardId: string;
        fromListId: string;
        toListId: string;
        newIndex: number;
      }>,
    ) {
      const { cardId, fromListId, toListId, newIndex } = action.payload;

      // Remove from source list
      const fromCards = state.cardsByList[fromListId] ?? [];
      const srcIdx = fromCards.indexOf(cardId);
      if (srcIdx !== -1) fromCards.splice(srcIdx, 1);
      state.cardsByList[fromListId] = fromCards;

      // Insert into target list
      const toCards = state.cardsByList[toListId] ?? [];
      toCards.splice(newIndex, 0, cardId);
      state.cardsByList[toListId] = toCards;

      // Update card's list reference
      const card = state.cards[cardId];
      if (card) card.list_id = toListId;
    },

    /** Reorder lists optimistically */
    applyOptimisticListReorder(
      state,
      action: PayloadAction<{ newOrder: string[] }>,
    ) {
      state.listOrder = action.payload.newOrder;
    },

    /** Update board title in-place (optimistic inline edit) */
    optimisticUpdateBoardTitle(state, action: PayloadAction<{ title: string }>) {
      if (state.board) state.board.title = action.payload.title;
    },

    /** Add a newly created card to the local state */
    addCard(
      state,
      action: PayloadAction<{ card: Card }>,
    ) {
      const { card } = action.payload;
      state.cards[card.id] = card;
      const listCards = state.cardsByList[card.list_id] ?? [];
      if (!listCards.includes(card.id)) {
        listCards.push(card.id);
      }
      state.cardsByList[card.list_id] = listCards;
    },

    /** Update a card in local board state (e.g. after modal edit) */
    updateCard(state, action: PayloadAction<{ card: Card }>) {
      const { card } = action.payload;
      if (state.cards[card.id]) {
        // [why] PATCH responses return raw DB rows without joined labels/members arrays.
        // Merging preserves those fields so card badges don't vanish after a field update.
        state.cards[card.id] = { ...state.cards[card.id], ...card };
      }
    },

    updateLabelInCards(state, action: PayloadAction<{ label: Card['labels'][number] }>) {
      const { label } = action.payload;
      for (const card of Object.values(state.cards)) {
        if (card.labels?.some((l) => l.id === label.id)) {
          card.labels = card.labels.map((l) => (l.id === label.id ? label : l));
        }
      }
    },

    /** Remove a deleted label from all cards in local state */
    removeLabelFromCards(state, action: PayloadAction<{ labelId: string }>) {
      const { labelId } = action.payload;
      for (const card of Object.values(state.cards)) {
        if (card.labels?.some((l) => l.id === labelId)) {
          card.labels = card.labels.filter((l) => l.id !== labelId);
        }
      }
    },

    /** Remove a card from local board state (e.g. after delete) */
    removeCard(state, action: PayloadAction<{ cardId: string; listId: string }>) {
      const { cardId, listId } = action.payload;
      delete state.cards[cardId];
      const listCards = state.cardsByList[listId];
      if (listCards) {
        state.cardsByList[listId] = listCards.filter((id) => id !== cardId);
      }
    },

    /** Add a newly created list to local state */
    addList(state, action: PayloadAction<{ list: List }>) {
      const { list } = action.payload;
      state.lists[list.id] = list;
      if (!state.listOrder.includes(list.id)) {
        state.listOrder.push(list.id);
      }
      state.cardsByList[list.id] = [];
    },

    /** Update a list's fields (e.g. title rename from WS event) */
    updateList(state, action: PayloadAction<{ list: List }>) {
      const { list } = action.payload;
      if (state.lists[list.id]) {
        state.lists[list.id] = list;
      }
    },

    /** Optimistically update a single field on a card (e.g. due_date from CalendarView drag) */
    optimisticUpdateCardField(
      state,
      action: PayloadAction<{ cardId: string; field: keyof Card; value: unknown }>,
    ) {
      const { cardId, field, value } = action.payload;
      if (state.cards[cardId]) {
        (state.cards[cardId] as Record<string, unknown>)[field as string] = value;
      }
    },

    /** Update board background URL (from WS event or API response) */
    updateBoardBackground(state, action: PayloadAction<{ background: string | null }>) {
      if (state.board) {
        state.board.background = action.payload.background;
      }
    },

    /** Move a card between lists without saving an undo snapshot (WS events) */
    remoteCardMove(
      state,
      action: PayloadAction<{ card: { id: string; list_id: string; position: string }; fromListId: string }>,
    ) {
      const { card, fromListId } = action.payload;

      // Remove from source list
      const fromCards = state.cardsByList[fromListId] ?? [];
      state.cardsByList[fromListId] = fromCards.filter((id) => id !== card.id);

      // Update the card record first so position comparisons below are current
      if (state.cards[card.id]) {
        state.cards[card.id] = { ...state.cards[card.id], ...card } as Card;
      }

      // Insert into target list at the correct sorted position (bytewise, matching DB COLLATE "C")
      const existing = (state.cardsByList[card.list_id] ?? []).filter((id) => id !== card.id);
      const insertIdx = existing.findIndex((id) => {
        const c = state.cards[id];
        return c != null && c.position > card.position;
      });
      if (insertIdx === -1) {
        existing.push(card.id);
      } else {
        existing.splice(insertIdx, 0, card.id);
      }
      state.cardsByList[card.list_id] = existing;
    },

    /** Sort cards in a single list by a selected user criterion. */
    sortCardsInList(
      state,
      action: PayloadAction<{ listId: string; sortBy: ListSortBy }>,
    ) {
      const { listId, sortBy } = action.payload;
      const listCardIds = state.cardsByList[listId];
      if (!listCardIds || listCardIds.length < 2) return;

      const toTime = (value: string | null | undefined): number => {
        if (!value) return Number.POSITIVE_INFINITY;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
      };

      const toAmount = (value: string | null | undefined): number => {
        if (!value) return Number.NEGATIVE_INFINITY;
        const parsed = Number.parseFloat(value);
        return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
      };

      const sortedIds = [...listCardIds].sort((leftId, rightId) => {
        const left = state.cards[leftId];
        const right = state.cards[rightId];
        if (!left || !right) return 0;

        if (sortBy === 'created-desc') {
          return toTime(right.created_at) - toTime(left.created_at);
        }

        if (sortBy === 'created-asc') {
          return toTime(left.created_at) - toTime(right.created_at);
        }

        if (sortBy === 'card-name') {
          return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
        }

        if (sortBy === 'due-date') {
          const dueCompare = toTime(left.due_date) - toTime(right.due_date);
          if (dueCompare !== 0) return dueCompare;
          return toTime(right.created_at) - toTime(left.created_at);
        }

        const priceCompare = toAmount(right.amount) - toAmount(left.amount);
        if (priceCompare !== 0) return priceCompare;
        return toTime(right.created_at) - toTime(left.created_at);
      });

      state.cardsByList[listId] = sortedIds;
    },

    /** Apply server-authoritative sorted order and positions for one list. */
    applySortedListFromServer(
      state,
      action: PayloadAction<{
        listId: string;
        cards: Array<{ id: string; list_id: string; position: string }>;
      }>,
    ) {
      const { listId, cards } = action.payload;
      state.cardsByList[listId] = cards.map((card) => card.id);
      cards.forEach((card) => {
        const existing = state.cards[card.id];
        if (!existing) return;
        existing.list_id = card.list_id;
        existing.position = card.position;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBoardDataThunk.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchBoardDataThunk.fulfilled, (state, action) => {
        state.status = 'idle';
        state.board = action.payload.data;

        const rawLists = action.payload.includes.lists as List[];
        const rawCards = action.payload.includes.cards as Card[];

        // Sort lists by position string (lexicographic)
        const sortedLists = [...rawLists]
          .filter((l) => !l.archived)
          .sort((a, b) => (String(a.position) < String(b.position) ? -1 : 1));

        state.listOrder = sortedLists.map((l) => l.id);
        state.lists = Object.fromEntries(sortedLists.map((l) => [l.id, l]));

        // Normalise cards
        state.cards = Object.fromEntries(rawCards.map((c) => [c.id, c]));
        state.cardsByList = {};
        state.listHydration = {};
        for (const list of sortedLists) {
          const cardsInList = rawCards
            .filter((c) => c.list_id === list.id && !c.archived)
            .sort((a, b) => (String(a.position) < String(b.position) ? -1 : 1))
            .map((c) => c.id);
          state.cardsByList[list.id] = cardsInList;

          const hydrationFromServer = action.payload.includes.card_hydration?.[list.id];
          if (hydrationFromServer) {
            state.listHydration[list.id] = {
              ...hydrationFromServer,
              loading: false,
              error: false,
            };
            continue;
          }

          state.listHydration[list.id] = {
            loaded: cardsInList.length,
            total: cardsInList.length,
            hasMore: false,
            nextOffset: null,
            loading: false,
            error: false,
          };
        }
      })
      .addCase(fetchBoardDataThunk.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(fetchListCardsBatchThunk.pending, (state, action) => {
        const { listId } = action.meta.arg;
        const current = state.listHydration[listId];
        state.listHydration[listId] = {
          loaded: current?.loaded ?? 0,
          total: current?.total ?? 0,
          hasMore: current?.hasMore ?? true,
          nextOffset: current?.nextOffset ?? action.meta.arg.offset,
          loading: true,
          error: false,
        };
      })
      .addCase(fetchListCardsBatchThunk.fulfilled, (state, action) => {
        const { listId, data, metadata } = action.payload;
        const currentIds = state.cardsByList[listId] ?? [];
        const mergedIds = [...currentIds];

        data.forEach((card) => {
          state.cards[card.id] = card;
          if (!mergedIds.includes(card.id)) mergedIds.push(card.id);
        });

        mergedIds.sort((a, b) => {
          const left = state.cards[a];
          const right = state.cards[b];
          if (!left || !right) return 0;
          return String(left.position) < String(right.position) ? -1 : 1;
        });

        state.cardsByList[listId] = mergedIds;
        state.listHydration[listId] = {
          loaded: mergedIds.length,
          total: metadata.total,
          hasMore: metadata.hasMore,
          nextOffset: metadata.nextOffset,
          loading: false,
          error: false,
        };
      })
      .addCase(fetchListCardsBatchThunk.rejected, (state, action) => {
        const { listId } = action.meta.arg;
        const current = state.listHydration[listId];
        if (!current) return;
        state.listHydration[listId] = {
          ...current,
          loading: false,
          error: true,
        };
      });
  },
});

export const boardSliceActions = boardSlice.actions;
export default boardSlice.reducer;

// ---------- Selectors ----------
// Cast to unknown first to avoid circular RootState → reducers → boardSlice dependency

type StateWithBoard = { board: BoardState };

export const selectBoard = (state: unknown) => (state as StateWithBoard).board.board;
export const selectListOrder = (state: unknown) => (state as StateWithBoard).board.listOrder;
export const selectLists = (state: unknown) => (state as StateWithBoard).board.lists;
export const selectCardsByList = (state: unknown) =>
  (state as StateWithBoard).board.cardsByList;
export const selectCards = (state: unknown) => (state as StateWithBoard).board.cards;
export const selectBoardStatus = (state: unknown) => (state as StateWithBoard).board.status;
export const selectListHydration = (state: unknown) =>
  (state as StateWithBoard).board.listHydration;

export const makeSelectCardIdsByListId = (listId: string) =>
  createSelector(selectCardsByList, (cardsByList) => cardsByList[listId] ?? []);

export const makeSelectCardsForListId = (listId: string) =>
  createSelector([makeSelectCardIdsByListId(listId), selectCards], (cardIds, cardsById) =>
    cardIds
      .map((cardId) => cardsById[cardId])
      .filter((card): card is Card => card !== undefined),
  );
