// CardModal container — connects Redux cardDetailSlice to the CardModal component.
// Handles data fetching, optimistic mutations, and URL sync.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  cardDetailSliceActions,
  fetchCardDetailThunk,
  fetchCardActivitiesThunk,
  selectCardDetail,
  selectCardDetailLabels,
  selectCardDetailMembers,
  selectCardDetailChecklists,
  selectCardDetailComments,
  selectCardDetailActivities,
  selectCardDetailStatus,
  selectCardDetailMeta,
} from '../../slices/cardDetailSlice';
import CardModal from '../../components/CardModal';
import CopyCardModal from '../../components/CopyCardModal';
import {
  patchCard,
  archiveCardToggle,
  patchChecklistItem,
  deleteChecklistItemById,
  createChecklist,
  patchChecklist,
  deleteChecklistById,
  postChecklistItemInGroup,
  postLabelAssign,
  deleteLabelAssign,
  postMemberAssign,
  deleteMemberAssign,
  createBoardLabel,
  updateBoardLabel,
  getBoardLabels,
  getBoardMembers,
  getCardComments,
  postCardComment,
  patchComment,
  deleteComment,
} from '../../api/cardDetail';
import type { Label, Checklist, ChecklistItem } from '../../api';
import { boardSliceActions, selectBoard } from '../../../Board/slices/boardSlice';
import { selectCurrentUser } from '~/slices/authSlice';
import { selectIsGuestInActiveWorkspace } from '~/extensions/Workspace/slices/workspaceSlice';
import { selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';
import { canBoardGuestWrite } from '../../../Board/mods/guestPermissions';
import apiClient from '~/common/api/client';

let _mutationCounter = 0;
const nextMutationId = () => `m${++_mutationCounter}`;

const CardModalContainer = () => {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const cardId = searchParams.get('card');

  const card = useAppSelector(selectCardDetail);
  const labels = useAppSelector(selectCardDetailLabels);
  const members = useAppSelector(selectCardDetailMembers);
  const checklists = useAppSelector(selectCardDetailChecklists);
  const comments = useAppSelector(selectCardDetailComments);
  const activities = useAppSelector(selectCardDetailActivities);
  const status = useAppSelector(selectCardDetailStatus);
  const meta = useAppSelector(selectCardDetailMeta);
  const { boardId } = meta;
  const currentUser = useAppSelector(selectCurrentUser);
  const board = useAppSelector(selectBoard);
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId);
  const isGuest = useAppSelector(selectIsGuestInActiveWorkspace);
  // [why] Derive write permission from the board's callerGuestType so VIEWER guests
  // cannot see comment/attachment/edit controls inside the card modal.
  const isViewerGuest = isGuest && !canBoardGuestWrite(board?.callerGuestType ?? null);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const allLabelsRef = useRef<Label[]>([]);
  const boardMembersRef = useRef<Array<{ id: string; email: string; name: string | null }>>([]);
  const [copyModalOpen, setCopyModalOpen] = useState(false);;

  const api = apiClient;

  // Open modal on cardId change
  useEffect(() => {
    if (!cardId) {
      dispatch(cardDetailSliceActions.closeModal());
      return;
    }
    dispatch(cardDetailSliceActions.openModal({ cardId }));
    dispatch(fetchCardDetailThunk({ cardId }));
    // Fetch comments separately
    getCardComments({ api, cardId })
      .then((comments) => dispatch(cardDetailSliceActions.setComments(comments)))
      .catch(() => {});
  }, [cardId, dispatch, api]);

  // Load board labels and members when boardId is known
  useEffect(() => {
    if (!boardId) return;
    getBoardLabels({ api, boardId })
      .then((labels) => { allLabelsRef.current = labels; setAllLabels(labels); })
      .catch(() => {});
    getBoardMembers({ api, boardId })
      .then((members) => { boardMembersRef.current = members; })
      .catch(() => {});
  }, [boardId, api]);

  const handleClose = useCallback(() => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      next.delete('card');
      return next;
    });
  }, [setSearchParams]);

  // ── Title / description / due date ─────────────────────────────────────
  const handleTitleSave = useCallback(
    (title: string) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: { title } }));
      patchCard({ api, cardId: card.id, fields: { title } })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          // Sync board view
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  const handleDescriptionSave = useCallback(
    (description: string) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: { description } }));
      patchCard({ api, cardId: card.id, fields: { description } })
        .then((updatedCard) =>
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard })),
        )
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  const handleStartDateChange = useCallback(
    (start_date: string | null) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: { start_date } }));
      patchCard({ api, cardId: card.id, fields: { start_date } })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  const handleDueDateChange = useCallback(
    (due_date: string | null) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: { due_date } }));
      patchCard({ api, cardId: card.id, fields: { due_date } })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  const handleDueCompleteChange = useCallback(
    (due_complete: boolean) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: { due_complete } }));
      patchCard({ api, cardId: card.id, fields: { due_complete } })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  // ── Archive / Delete ────────────────────────────────────────────────────
  const handleArchive = useCallback(async () => {
    if (!card) return;
    await archiveCardToggle({ api, cardId: card.id });
    dispatch(fetchCardDetailThunk({ cardId: card.id }));
    // If archiving (not unarchiving) close modal
    if (!card.archived) handleClose();
  }, [api, card, dispatch, handleClose]);

  const handleDelete = useCallback(async () => {
    if (!card) return;
    await api.delete(`/cards/${card.id}`);
    dispatch(boardSliceActions.removeCard({ cardId: card.id, listId: card.list_id }));
    handleClose();
  }, [api, card, dispatch, handleClose]);

  const handleCopyLink = useCallback(() => {
    globalThis.navigator.clipboard.writeText(globalThis.location.href).catch(() => {});
  }, []);

  const handleCopyCard = useCallback(() => {
    setCopyModalOpen(true);
  }, []);

  // ── Checklist group CRUD ────────────────────────────────────────────────
  const handleCreateChecklist = useCallback(
    async (title?: string) => {
      if (!card) return;
      const tempId = `temp-cl-${nextMutationId()}`;
      const tempChecklist: Checklist = {
        id: tempId,
        card_id: card.id,
        title: title ?? 'Checklist',
        position: String(Date.now()),
        items: [],
      };
      dispatch(cardDetailSliceActions.applyOptimisticChecklistAdd({ mutationId: tempId, checklist: tempChecklist }));
      try {
        const checklist = await createChecklist({
          api,
          cardId: card.id,
          ...(typeof title === 'string' ? { title } : {}),
        });
        dispatch(cardDetailSliceActions.confirmChecklistAdd({ mutationId: tempId, checklist }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackChecklist({ mutationId: tempId }));
      }
    },
    [api, card, dispatch],
  );

  const handleRenameChecklist = useCallback(
    async (checklistId: string, title: string) => {
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticChecklistRename({ mutationId, checklistId, title }));
      try {
        await patchChecklist({ api, checklistId, title });
        dispatch(cardDetailSliceActions.confirmChecklist({ mutationId }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackChecklist({ mutationId }));
      }
    },
    [api, dispatch],
  );

  const handleDeleteChecklist = useCallback(
    async (checklistId: string) => {
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticChecklistDelete({ mutationId, checklistId }));
      try {
        await deleteChecklistById({ api, checklistId });
        dispatch(cardDetailSliceActions.confirmChecklist({ mutationId }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackChecklist({ mutationId }));
      }
    },
    [api, dispatch],
  );

  // ── Checklist item CRUD ─────────────────────────────────────────────────
  const handleItemAdd = useCallback(
    async (checklistId: string, title: string) => {
      const tempId = `temp-item-${nextMutationId()}`;
      const tempItem: ChecklistItem = {
        id: tempId,
        card_id: card?.id ?? '',
        checklist_id: checklistId,
        title,
        checked: false,
        position: String(Date.now()),
      };
      dispatch(cardDetailSliceActions.applyOptimisticChecklistItemAdd({ mutationId: tempId, checklistId, item: tempItem }));
      try {
        const item = await postChecklistItemInGroup({ api, checklistId, title });
        dispatch(cardDetailSliceActions.confirmChecklistItem({ mutationId: tempId, checklistId, item }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackChecklist({ mutationId: tempId }));
      }
    },
    [api, card, dispatch],
  );

  const handleItemToggle = useCallback(
    async (checklistId: string, itemId: string, checked: boolean) => {
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticChecklistToggle({ mutationId, checklistId, itemId, checked }));
      try {
        const item = await patchChecklistItem({ api, itemId, fields: { checked } });
        dispatch(cardDetailSliceActions.confirmChecklistItem({ mutationId, checklistId, item }));
        // [why] Checklist toggles generate an activity event server-side; re-fetch to keep the feed in sync
        // since the WebSocket may not be available in all environments.
        if (card?.id) dispatch(fetchCardActivitiesThunk({ cardId: card.id }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackChecklist({ mutationId }));
      }
    },
    [api, card, dispatch],
  );

  const handleItemRename = useCallback(
    async (checklistId: string, itemId: string, title: string) => {
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticChecklistItemRename({ mutationId, checklistId, itemId, title }));
      try {
        const item = await patchChecklistItem({ api, itemId, fields: { title } });
        dispatch(cardDetailSliceActions.confirmChecklistItem({ mutationId, checklistId, item }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackChecklist({ mutationId }));
      }
    },
    [api, dispatch],
  );

  const handleItemDelete = useCallback(
    async (checklistId: string, itemId: string) => {
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticChecklistItemDelete({ mutationId, checklistId, itemId }));
      try {
        await deleteChecklistItemById({ api, itemId });
        dispatch(cardDetailSliceActions.confirmChecklist({ mutationId }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackChecklist({ mutationId }));
      }
    },
    [api, dispatch],
  );

  // ── Labels ──────────────────────────────────────────────────────────────
  const handleLabelAttach = useCallback(
    async (labelId: string) => {
      if (!card) return;
      const label = allLabelsRef.current.find((l) => l.id === labelId);
      if (!label) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticLabelAssign({ mutationId, label }));
      try {
        await postLabelAssign({ api, cardId: card.id, labelId });
        dispatch(cardDetailSliceActions.confirmLabel({ mutationId }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackLabel({ mutationId }));
      }
    },
    [api, card, dispatch],
  );

  const handleLabelDetach = useCallback(
    async (labelId: string) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticLabelDetach({ mutationId, labelId }));
      try {
        await deleteLabelAssign({ api, cardId: card.id, labelId });
        dispatch(cardDetailSliceActions.confirmLabel({ mutationId }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackLabel({ mutationId }));
      }
    },
    [api, card, dispatch],
  );

  const handleLabelCreate = useCallback(
    async (name: string, color: string) => {
      if (!card || !boardId) return;
      const newLabel = await createBoardLabel({ api, boardId, name, color });
      const updated = [...allLabelsRef.current, newLabel];
      allLabelsRef.current = updated;
      setAllLabels(updated);
      await handleLabelAttach(newLabel.id);
    },
    [api, card, boardId, handleLabelAttach],
  );

  const handleLabelUpdate = useCallback(
    async (labelId: string, name: string, color: string) => {
      const updated = await updateBoardLabel({ api, labelId, name, color });
      const newList = allLabelsRef.current.map((l) => (l.id === labelId ? updated : l));
      allLabelsRef.current = newList;
      setAllLabels(newList);
    },
    [api],
  );

  // ── Member assign / remove ──────────────────────────────────────────────
  const handleMemberAssign = useCallback(
    async (userId: string) => {
      if (!card) return;
      const boardMember = boardMembersRef.current.find((m) => m.id === userId);
      if (!boardMember) return;
      const mutationId = nextMutationId();
      dispatch(
        cardDetailSliceActions.applyOptimisticMemberAssign({
          mutationId,
          member: boardMember,
        }),
      );
      try {
        await postMemberAssign({ api, cardId: card.id, userId });
        dispatch(cardDetailSliceActions.confirmMember({ mutationId }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackMember({ mutationId }));
      }
    },
    [api, card, dispatch],
  );

  const handleMemberRemove = useCallback(
    async (userId: string) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticMemberRemove({ mutationId, memberId: userId }));
      try {
        await deleteMemberAssign({ api, cardId: card.id, userId });
        dispatch(cardDetailSliceActions.confirmMember({ mutationId }));
      } catch {
        dispatch(cardDetailSliceActions.rollbackMember({ mutationId }));
      }
    },
    [api, card, dispatch],
  );

  const handleMoneySave = useCallback(
    async (amount: string | null, currency: string) => {
      if (!card) return;
      const mutationId = nextMutationId();
      // Convert string amount to number before sending — server enforces numeric type
      const numericAmount = amount === null ? null : Number.parseFloat(amount);
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: { amount: amount ?? null, currency } }));
      patchCard({ api, cardId: card.id, fields: { amount: numericAmount, currency } })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  const handleCoverColorChange = useCallback(
    (cover_color: string | null) => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({
        mutationId,
        fields: { cover_color, cover_attachment_id: null, cover_image_url: null },
      }));
      patchCard({ api, cardId: card.id, fields: { cover_color, cover_attachment_id: null } })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  const handleCoverSizeChange = useCallback(
    (cover_size: 'SMALL' | 'FULL') => {
      if (!card) return;
      const mutationId = nextMutationId();
      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: { cover_size } }));
      patchCard({ api, cardId: card.id, fields: { cover_size } })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  const handleCoverAttachmentChange = useCallback(
    (cover_attachment_id: string | null) => {
      if (!card) return;
      const mutationId = nextMutationId();
      const optimisticFields = cover_attachment_id
        ? { cover_attachment_id, cover_color: null, cover_image_url: null }
        : { cover_attachment_id: null, cover_image_url: null };
      const apiFields = cover_attachment_id
        ? { cover_attachment_id, cover_color: null }
        : { cover_attachment_id: null };

      dispatch(cardDetailSliceActions.applyOptimisticCardUpdate({ mutationId, fields: optimisticFields }));
      patchCard({ api, cardId: card.id, fields: apiFields })
        .then((updatedCard) => {
          dispatch(cardDetailSliceActions.confirmCardUpdate({ mutationId, card: updatedCard }));
          dispatch(boardSliceActions.updateCard({ card: updatedCard }));
        })
        .catch(() => dispatch(cardDetailSliceActions.rollbackCardUpdate({ mutationId })));
    },
    [api, card, dispatch],
  );

  // ── Comments ───────────────────────────────────────────────────────────
  const handleAddComment = useCallback(
    async (content: string) => {
      if (!card) return;
      const comment = await postCardComment({ api, cardId: card.id, content });
      dispatch(cardDetailSliceActions.addComment(comment));
    },
    [api, card, dispatch],
  );

  const handleEditComment = useCallback(
    async (commentId: string, content: string) => {
      const comment = await patchComment({ api, commentId, content });
      dispatch(cardDetailSliceActions.updateComment(comment));
    },
    [api, dispatch],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      await deleteComment({ api, commentId });
      dispatch(cardDetailSliceActions.removeComment({ commentId }));
    },
    [api, dispatch],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  if (!cardId) return null;

  if (status === 'loading' && !card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="text-slate-400 animate-pulse">Loading card…</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-slate-900 rounded-xl p-8 text-red-400">
          Failed to load card.{' '}
          <button className="underline" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <>
      <CardModal
      open={!!cardId}
      boardId={boardId ?? ''}
      card={card}
      listTitle={meta.listTitle}
      boardTitle={meta.boardTitle}
      labels={labels}
      allLabels={allLabels}
      members={members}
      boardMembers={boardMembersRef.current}
      checklists={checklists}
      comments={comments}
      activities={activities}
      currentUserId={currentUser?.id ?? ''}
      onClose={handleClose}
      onTitleSave={handleTitleSave}
      onDescriptionSave={handleDescriptionSave}
      onDueDateChange={handleDueDateChange}
      onDueCompleteChange={handleDueCompleteChange}
      onStartDateChange={handleStartDateChange}
      onArchive={handleArchive}
      onDelete={handleDelete}
      onCopyLink={handleCopyLink}
      onCopyCard={handleCopyCard}
      onCreateChecklist={handleCreateChecklist}
      onRenameChecklist={handleRenameChecklist}
      onDeleteChecklist={handleDeleteChecklist}
      onItemAdd={handleItemAdd}
      onItemToggle={handleItemToggle}
      onItemRename={handleItemRename}
      onItemDelete={handleItemDelete}
      onLabelAttach={handleLabelAttach}
      onLabelDetach={handleLabelDetach}
      onLabelCreate={handleLabelCreate}
      onLabelUpdate={handleLabelUpdate}
      onMemberAssign={handleMemberAssign}
      onMemberRemove={handleMemberRemove}
      onAddComment={handleAddComment}
      onEditComment={handleEditComment}
      onDeleteComment={handleDeleteComment}
      onMoneySave={handleMoneySave}
      onCoverColorChange={handleCoverColorChange}
      onCoverSizeChange={handleCoverSizeChange}
      onCoverAttachmentChange={handleCoverAttachmentChange}
      isViewerGuest={isViewerGuest}
      />
      {copyModalOpen && card && activeWorkspaceId && (
        <CopyCardModal
          cardId={card.id}
          cardTitle={card.title}
          checklistCount={checklists.length}
          memberCount={members.length}
          currentBoardId={boardId}
          currentListId={card.list_id}
          workspaceId={activeWorkspaceId}
          api={api}
          onClose={() => setCopyModalOpen(false)}
          onSuccess={(newCard) => {
            setCopyModalOpen(false);
            dispatch(boardSliceActions.addCard({ card: newCard }));
          }}
        />
      )}
    </>
  );
};

export default CardModalContainer;
