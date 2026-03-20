// cardDetailSlice — modal state, card detail, checklist, labels, members, comments, activities.
// Sprint 19: optimistic updates with rollback per architecture spec.
// Sprint 29: activities sideloaded via ?include=activities.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppAsyncThunk } from '~/utils/redux';
import type { Card, Label, CardMember, ChecklistItem, Checklist, CardDetail } from '../api';
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
  checklists: Checklist[];
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
      checklists: Checklist[];
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
  checklists: [],
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
      state.checklists = [];
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
        fields: Partial<Pick<Card, 'title' | 'description' | 'due_date' | 'due_complete' | 'start_date' | 'amount' | 'currency' | 'cover_attachment_id' | 'cover_color' | 'cover_size' | 'cover_image_url'>>;
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
      if (state.card?.id === card.id) {
        state.card = { ...state.card, ...card };
      }
    },

    // ── Optimistic checklist group actions ─────────────────────────────────
    applyOptimisticChecklistAdd(
      state,
      action: PayloadAction<{ mutationId: string; checklist: Checklist }>,
    ) {
      const { mutationId, checklist } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      state.checklists.push(checklist);
    },

    confirmChecklistAdd(
      state,
      action: PayloadAction<{ mutationId: string; checklist: Checklist }>,
    ) {
      const { mutationId, checklist } = action.payload;
      delete state.snapshots[mutationId];
      const idx = state.checklists.findIndex((c) => c.id === checklist.id || c.id === mutationId);
      if (idx >= 0) {
        state.checklists[idx] = checklist;
      } else {
        state.checklists.push(checklist);
      }
    },

    applyOptimisticChecklistDelete(
      state,
      action: PayloadAction<{ mutationId: string; checklistId: string }>,
    ) {
      const { mutationId, checklistId } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      state.checklists = state.checklists.filter((c) => c.id !== checklistId);
    },

    applyOptimisticChecklistRename(
      state,
      action: PayloadAction<{ mutationId: string; checklistId: string; title: string }>,
    ) {
      const { mutationId, checklistId, title } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      const cl = state.checklists.find((c) => c.id === checklistId);
      if (cl) cl.title = title;
    },

    confirmChecklist(state, action: PayloadAction<{ mutationId: string }>) {
      delete state.snapshots[action.payload.mutationId];
    },

    rollbackChecklist(state, action: PayloadAction<{ mutationId: string }>) {
      rollback(state, action.payload.mutationId);
    },

    // ── Optimistic checklist item actions ───────────────────────────────────
    applyOptimisticChecklistToggle(
      state,
      action: PayloadAction<{ mutationId: string; checklistId: string; itemId: string; checked: boolean }>,
    ) {
      const { mutationId, checklistId, itemId, checked } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      const cl = state.checklists.find((c) => c.id === checklistId);
      const item = cl?.items.find((i) => i.id === itemId);
      if (item) item.checked = checked;
    },

    applyOptimisticChecklistItemAdd(
      state,
      action: PayloadAction<{ mutationId: string; checklistId: string; item: ChecklistItem }>,
    ) {
      const { mutationId, checklistId, item } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      const cl = state.checklists.find((c) => c.id === checklistId);
      if (cl) cl.items.push(item);
    },

    confirmChecklistItem(
      state,
      action: PayloadAction<{ mutationId: string; checklistId: string; item: ChecklistItem }>,
    ) {
      const { mutationId, checklistId, item } = action.payload;
      delete state.snapshots[mutationId];
      const cl = state.checklists.find((c) => c.id === checklistId);
      if (!cl) return;
      const idx = cl.items.findIndex((i) => i.id === item.id || i.id === mutationId);
      if (idx >= 0) {
        cl.items[idx] = item;
      } else {
        cl.items.push(item);
      }
    },

    applyOptimisticChecklistItemDelete(
      state,
      action: PayloadAction<{ mutationId: string; checklistId: string; itemId: string }>,
    ) {
      const { mutationId, checklistId, itemId } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      const cl = state.checklists.find((c) => c.id === checklistId);
      if (cl) cl.items = cl.items.filter((i) => i.id !== itemId);
    },

    applyOptimisticChecklistItemRename(
      state,
      action: PayloadAction<{ mutationId: string; checklistId: string; itemId: string; title: string }>,
    ) {
      const { mutationId, checklistId, itemId, title } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      const cl = state.checklists.find((c) => c.id === checklistId);
      const item = cl?.items.find((i) => i.id === itemId);
      if (item) item.title = title;
    },

    // ── Optimistic label assign/unassign ────────────────────────────────────
    applyOptimisticLabelAssign(
      state,
      action: PayloadAction<{ mutationId: string; label: Label }>,
    ) {
      const { mutationId, label } = action.payload;
      state.snapshots[mutationId] = snapshot(state);
      if (!state.labels.some((l) => l.id === label.id)) {
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
      if (!state.members.some((m) => m.id === member.id)) {
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
        // [why] Server returns checklists with nested items. Fall back to empty array for
        // old clients that don't have the migration applied yet.
        state.checklists = (includes.checklists ?? []) as Checklist[];
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
    checklists: state.checklists.map((cl) => ({ ...cl, items: [...cl.items] })),
  };
}

function rollback(state: CardDetailState, mutationId: string) {
  const snap = state.snapshots[mutationId];
  if (snap) {
    if (snap.card) state.card = snap.card;
    state.labels = snap.labels;
    state.members = snap.members;
    state.checklists = snap.checklists;
    delete state.snapshots[mutationId];
  }
}

// ---------- Selectors ----------

export const selectOpenCardId = (s: { cardDetail: CardDetailState }) => s.cardDetail.openCardId;
export const selectCardDetail = (s: { cardDetail: CardDetailState }) => s.cardDetail.card;
export const selectCardDetailLabels = (s: { cardDetail: CardDetailState }) => s.cardDetail.labels;
export const selectCardDetailMembers = (s: { cardDetail: CardDetailState }) => s.cardDetail.members;
export const selectCardDetailChecklists = (s: { cardDetail: CardDetailState }) => s.cardDetail.checklists;
/** @deprecated Use selectCardDetailChecklists — kept for any callers that haven't migrated */
export const selectCardDetailChecklist = (s: { cardDetail: CardDetailState }) =>
  s.cardDetail.checklists.flatMap((cl) => cl.items);
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
