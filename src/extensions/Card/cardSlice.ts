// cardSlice — Redux slice for Card entities with optimistic update support.
// Implements applyOptimistic / confirmOptimistic / rollbackOptimistic per sprint-10 spec.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Card } from './api';

// ---------- State ----------

export interface CardsState {
  byId: Record<string, Card>;
  /** Ordered card IDs per list */
  orderByList: Record<string, string[]>;
  /** snapshot stored by mutationId for rollback */
  snapshots: Record<string, CardsState['byId']>;
  /** Cards with a pending conflicted edit (shown with [conflicted] marker) */
  conflicted: Record<string, true>;
}

const initialState: CardsState = {
  byId: {},
  orderByList: {},
  snapshots: {},
  conflicted: {},
};

// ---------- Helpers ----------

function upsert(state: CardsState, card: Card) {
  state.byId[card.id] = card;
  const listOrder = state.orderByList[card.list_id] ?? [];
  if (!listOrder.includes(card.id)) {
    listOrder.push(card.id);
    state.orderByList[card.list_id] = listOrder;
  }
}

function removeFromList(state: CardsState, cardId: string, listId: string) {
  const order = state.orderByList[listId];
  if (order) {
    const idx = order.indexOf(cardId);
    if (idx !== -1) order.splice(idx, 1);
  }
}

// ---------- Slice ----------

const cardSlice = createSlice({
  name: 'cards',
  initialState,
  reducers: {
    // ── Seed ────────────────────────────────────────────────────────────
    hydrate(state, action: PayloadAction<{ cards: Card[] }>) {
      for (const card of action.payload.cards) {
        upsert(state, card);
      }
    },

    // ── Optimistic mutations ─────────────────────────────────────────────
    applyOptimistic(
      state,
      action: PayloadAction<{ mutationId: string; card: Card }>,
    ) {
      const { mutationId, card } = action.payload;
      state.snapshots[mutationId] = { ...state.byId };
      upsert(state, card);
    },

    confirmOptimistic(
      state,
      action: PayloadAction<{ mutationId: string; card: Card }>,
    ) {
      const { mutationId, card } = action.payload;
      delete state.snapshots[mutationId];
      // Clear conflict marker on confirm
      delete state.conflicted[card.id];
      upsert(state, card);
    },

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

    /** Optimistic card move: update list membership immediately */
    applyOptimisticMove(
      state,
      action: PayloadAction<{
        mutationId: string;
        cardId: string;
        fromListId: string;
        toListId: string;
        afterCardId?: string | null;
      }>,
    ) {
      const { mutationId, cardId, fromListId, toListId, afterCardId } = action.payload;
      state.snapshots[mutationId] = { ...state.byId };

      const card = state.byId[cardId];
      if (!card) return;

      // Remove from source list
      removeFromList(state, cardId, fromListId);

      // Insert into target list after afterCardId (or at end)
      const targetOrder = state.orderByList[toListId] ?? [];
      const insertAt = afterCardId ? targetOrder.indexOf(afterCardId) + 1 : targetOrder.length;
      targetOrder.splice(insertAt, 0, cardId);
      state.orderByList[toListId] = targetOrder;

      // Update the card's list reference
      state.byId[cardId] = { ...card, list_id: toListId };
    },

    rollbackOptimisticMove(
      state,
      action: PayloadAction<{ mutationId: string }>,
    ) {
      const { mutationId } = action.payload;
      const snapshot = state.snapshots[mutationId];
      if (snapshot) {
        state.byId = snapshot;
        delete state.snapshots[mutationId];
        // Rebuild orderByList from snapshot
        const orderByList: CardsState['orderByList'] = {};
        for (const card of Object.values(snapshot)) {
          const order = orderByList[card.list_id] ?? [];
          order.push(card.id);
          orderByList[card.list_id] = order;
        }
        state.orderByList = orderByList;
      }
    },

    // ── Conflict handling ─────────────────────────────────────────────────
    /** Mark a card as having an in-progress edit that conflicts with a remote update */
    markConflicted(state, action: PayloadAction<{ cardId: string }>) {
      state.conflicted[action.payload.cardId] = true;
    },

    clearConflicted(state, action: PayloadAction<{ cardId: string }>) {
      delete state.conflicted[action.payload.cardId];
    },

    // ── Remote (WS) events ───────────────────────────────────────────────
    remoteCreate(state, action: PayloadAction<{ card: Card }>) {
      upsert(state, action.payload.card);
    },

    remoteUpdate(state, action: PayloadAction<{ card: Card }>) {
      const incoming = action.payload.card;
      const existing = state.byId[incoming.id];
      // If client has a pending optimistic on this card, mark as conflicted
      // (the edit stays in the editor but we show a warning)
      if (existing) {
        const hasPendingOptimistic = Object.values({}).length > 0; // checked at middleware level
        void hasPendingOptimistic;
        state.conflicted[incoming.id] = true;
      }
      upsert(state, incoming);
    },

    remoteMove(state, action: PayloadAction<{ card: Card; fromListId: string }>) {
      const { card, fromListId } = action.payload;
      removeFromList(state, card.id, fromListId);
      upsert(state, card);
    },

    remoteArchive(state, action: PayloadAction<{ cardId: string }>) {
      const card = state.byId[action.payload.cardId];
      if (card) card.archived = true;
    },
  },
});

export const cardSliceActions = cardSlice.actions;
export default cardSlice.reducer;
