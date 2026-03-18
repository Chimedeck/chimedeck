// cardDetailSlice — modal state, card detail, checklist, labels, members, comments, activities.
// Sprint 19: optimistic updates with rollback per architecture spec.
// Sprint 29: activities sideloaded via ?include=activities.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppAsyncThunk } from '~/utils/redux';
import type { Card, Label, CardMember, ChecklistItem, CardDetail } from '../api';
import type { CommentData } from '../api/cardDetail';

export interface ActivityData {
  id: string;
  entity_type: string;
  entity_id: string;
  board_id: string | null;
  action: string;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_avatar_url: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

// ---------- State ----------

export interface CardDetailState {
  openCardId: string | null;
  card: Card | null;
  listTitle: string;
  boardTitle: string;
  boardId: string;
  labels: Label[];
  members: CardMember[];
  checklistItems: ChecklistItem[];
  comments: CommentData[];
  activities: ActivityData[];
  status: 'idle' | 'loading' | 'error';
  /** Optimistic snapshots by mutationId for rollback */
  snapshots: Record<
    string,
    {
      card: Card | null;
      labels: Label[];
      members: CardMember[];
      checklistItems: ChecklistItem[];
    }
  >;
}

const initialState: CardDetailState = {
  openCardId: null,
  card: null,
  listTitle: '',
  boardTitle: '',
  boardId: '',
  labels: [],
  members: [],
  checklistItems: [],
  comments: [],
  activities: [],
  status: 'idle',
  snapshots: {},
};

// ---------- Thunks ----------

export const fetchCardDetailThunk = createAppAsyncThunk(
  'cardDetail/fetch',
  async ({ cardId }: { cardId: string }, { extra }) => {
    const api = (extra as { api: { get: <T>(url: string) => Promise<T> } }).api;
    const result = await api.get<{ data: Card; includes: CardDetail['includes'] }>(
      `/cards/${cardId}?include=activities`,
    );
    return result;
  },
);

// ---------- Slice ----------

const cardDetailSlice = createSlice({
  name: 'cardDetail',
  initialState,
  reducers: {
    openModal(state, action: PayloadAction<{ cardId: string }>) {
      state.openCardId = action.payload.cardId;
      state.status = 'loading';
    },

    closeModal(state) {
      state.openCardId = null;
      state.card = null;
      state.listTitle = '';
      state.boardTitle = '';
      state.boardId = '';
      state.labels = [];
      state.members = [];
      state.checklistItems = [];
      state.comments = [];
      state.activities = [];
      state.status = 'idle';
      state.snapshots = {};
    },

    // ── Comments ────────────────────────────────────────────────────────────────
    setComments(state, action: PayloadAction<CommentData[]>) {
      state.comments = action.payload;
    },

    addComment(state, action: PayloadAction<CommentData>) {
      // Guard against duplicate dispatches (API response + realtime event both fire addComment)
      if (!action.payload?.id) return;
      const alreadyExists = state.comments.some((c) => c.id === action.payload.id);
      if (!alreadyExists) state.comments.push(action.payload);
    },

    updateComment(state, action: PayloadAction<CommentData>) {
      const idx = state.comments.findIndex((c) => c.id === action.payload.id);
      if (idx !== -1) state.comments[idx] = action.payload;
    },

    removeComment(state, action: PayloadAction<{ commentId: string }>) {
      // Mark as deleted (soft delete per schema) rather than removing
      const comment = state.comments.find((c) => c.id === action.payload.commentId);
      if (comment) comment.deleted = true;
    },

    // ── Realtime activity events ─────────────────────────────────────────────
    addActivity(state, action: PayloadAction<ActivityData>) {
      // Only append if this activity belongs to the currently open card.
      if (state.openCardId !== action.payload.entity_id) return;
      // Deduplicate: skip if already present (initial fetch + realtime can both deliver the same row).
      if (state.activities.some((a) => a.id === action.payload.id)) return;
      state.activities.push(action.payload);
    },


    // ── Optimistic card field update ────────────────────────────────────────
    applyOptimisticCardUpdate(
      state,
      action: PayloadAction<{
        mutationId: string;
        fields: Partial<Pick<Card, 'title' | 'description' | 'due_date' | 'start_date' | 'amount' | 'currency'>>;
      }>,
    ) {
      const { mutationId, fields } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      if (state.card) Object.assign(state.card, fields);
    },

    confirmCardUpdate(
      state,
      action: PayloadAction<{ mutationId: string; card: Card }>,
    ) {
      const { mutationId, card } = action.payload;
      delete state.snapshots[mutationId];
      state.card = card;
    },

    rollbackCardUpdate(state, action: PayloadAction<{ mutationId: string }>) {
      rollback(state, action.payload.mutationId);
    },

    /** Apply a remote (WS) update to the open card — skipped if card ID doesn't match */
    remoteUpdate(state, action: PayloadAction<{ card: Card }>) {
      const { card } = action.payload;
      if (state.card && state.card.id === card.id) {
        state.card = { ...state.card, ...card };
      }
    },

    // ── Optimistic checklist ────────────────────────────────────────────────
    applyOptimisticChecklistToggle(
      state,
      action: PayloadAction<{ mutationId: string; itemId: string; checked: boolean }>,
    ) {
      const { mutationId, itemId, checked } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      const item = state.checklistItems.find((i) => i.id === itemId);
      if (item) item.checked = checked;
    },

    applyOptimisticChecklistAdd(
      state,
      action: PayloadAction<{ mutationId: string; item: ChecklistItem }>,
    ) {
      const { mutationId, item } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      state.checklistItems.push(item);
    },

    confirmChecklistItem(
      state,
      action: PayloadAction<{ mutationId: string; item: ChecklistItem }>,
    ) {
      const { mutationId, item } = action.payload;
      delete state.snapshots[mutationId];
      // Replace temp/confirmed item
      const idx = state.checklistItems.findIndex((i) => i.id === item.id || i.id === mutationId);
      if (idx !== -1) {
        state.checklistItems[idx] = item;
      } else {
        state.checklistItems.push(item);
      }
    },

    confirmChecklist(state, action: PayloadAction<{ mutationId: string }>) {
      delete state.snapshots[action.payload.mutationId];
    },

    applyOptimisticChecklistDelete(
      state,
      action: PayloadAction<{ mutationId: string; itemId: string }>,
    ) {
      const { mutationId, itemId } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      state.checklistItems = state.checklistItems.filter((i) => i.id !== itemId);
    },

    rollbackChecklist(state, action: PayloadAction<{ mutationId: string }>) {
      rollback(state, action.payload.mutationId);
    },

    // ── Optimistic label assign/unassign ────────────────────────────────────
    applyOptimisticLabelAssign(
      state,
      action: PayloadAction<{ mutationId: string; label: Label }>,
    ) {
      const { mutationId, label } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      if (!state.labels.find((l) => l.id === label.id)) {
        state.labels.push(label);
      }
    },

    applyOptimisticLabelDetach(
      state,
      action: PayloadAction<{ mutationId: string; labelId: string }>,
    ) {
      const { mutationId, labelId } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      state.labels = state.labels.filter((l) => l.id !== labelId);
    },

    confirmLabel(state, action: PayloadAction<{ mutationId: string }>) {
      delete state.snapshots[action.payload.mutationId];
    },

    rollbackLabel(state, action: PayloadAction<{ mutationId: string }>) {
      rollback(state, action.payload.mutationId);
    },

    // ── Optimistic member assign/unassign ───────────────────────────────────
    applyOptimisticMemberAssign(
      state,
      action: PayloadAction<{ mutationId: string; member: CardMember }>,
    ) {
      const { mutationId, member } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      if (!state.members.find((m) => m.id === member.id)) {
        state.members.push(member);
      }
    },

    applyOptimisticMemberRemove(
      state,
      action: PayloadAction<{ mutationId: string; memberId: string }>,
    ) {
      const { mutationId, memberId } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      state.members = state.members.filter((m) => m.id !== memberId);
    },

    confirmMember(state, action: PayloadAction<{ mutationId: string }>) {
      delete state.snapshots[action.payload.mutationId];
    },

    rollbackMember(state, action: PayloadAction<{ mutationId: string }>) {
      rollback(state, action.payload.mutationId);
    },

    // ── Remote WS events ────────────────────────────────────────────────────
    remoteCardUpdate(state, action: PayloadAction<{ card: Card }>) {
      if (state.card?.id === action.payload.card.id) {
        state.card = action.payload.card;
      }
    },
  },

  extraReducers(builder) {
    builder
      .addCase(fetchCardDetailThunk.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchCardDetailThunk.fulfilled, (state, action) => {
        const { data, includes } = action.payload;
        state.card = data;
        state.listTitle = includes.list.title;
        state.boardTitle = includes.board.title;
        state.boardId = includes.board.id;
        state.labels = includes.labels;
        state.members = includes.members;
        state.checklistItems = includes.checklistItems;
        state.activities = (includes.activities ?? []) as ActivityData[];
        state.status = 'idle';
      })
      .addCase(fetchCardDetailThunk.rejected, (state) => {
        state.status = 'error';
      });
  },
});

// ---------- Helpers ----------

function snapshot(state: CardDetailState) {
  return {
    card: state.card ? { ...state.card } : null,
    labels: [...state.labels],
    members: [...state.members],
    checklistItems: state.checklistItems.map((i) => ({ ...i })),
  };
}

function rollback(state: CardDetailState, mutationId: string) {
  const snap = state.snapshots[mutationId];
  if (snap) {
    if (snap.card) state.card = snap.card;
    state.labels = snap.labels;
    state.members = snap.members;
    state.checklistItems = snap.checklistItems;
    delete state.snapshots[mutationId];
  }
}

// ---------- Selectors ----------

export const selectOpenCardId = (s: { cardDetail: CardDetailState }) => s.cardDetail.openCardId;
export const selectCardDetail = (s: { cardDetail: CardDetailState }) => s.cardDetail.card;
export const selectCardDetailLabels = (s: { cardDetail: CardDetailState }) => s.cardDetail.labels;
export const selectCardDetailMembers = (s: { cardDetail: CardDetailState }) => s.cardDetail.members;
export const selectCardDetailChecklist = (s: { cardDetail: CardDetailState }) =>
  s.cardDetail.checklistItems;
export const selectCardDetailComments = (s: { cardDetail: CardDetailState }) => s.cardDetail.comments;
export const selectCardDetailActivities = (s: { cardDetail: CardDetailState }) => s.cardDetail.activities;
export const selectCardDetailStatus = (s: { cardDetail: CardDetailState }) => s.cardDetail.status;
export const selectCardDetailMeta = (s: { cardDetail: CardDetailState }) => ({
  listTitle: s.cardDetail.listTitle,
  boardTitle: s.cardDetail.boardTitle,
  boardId: s.cardDetail.boardId,
});

export const cardDetailSliceActions = cardDetailSlice.actions;
export default cardDetailSlice.reducer;
