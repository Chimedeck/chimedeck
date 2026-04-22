// BoardPage — renders a single board with lists and cards as a kanban view.
// Sprint 18: uses boardSlice (DndContext via BoardCanvas, optimistic card/list drag).
// Sprint 19: ?card=:id URL param opens CardModal.
// Sprint 20: real-time sync via useWebSocket + useBoardSync; ConnectionBadge in header.
// Sprint 48: tabbed view adds Activity, Comments, and Archived Cards panels.
// Sprint 52: BoardViewSwitcher mounted above canvas for Kanban/Table/Calendar/Timeline.
// Sprint 56: replace browser confirm() with BoardDeleteDialog/ListDeleteDialog for nested content.
// Sprint 87: redirect to workspace boards page (with success toast via navigate state) when the currently open board is deleted.
// Sprint 116: Health Check fifth tab (HEALTH_CHECK_ENABLED flag).
import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import {
  fetchBoardDataThunk,
  boardSliceActions,
  selectBoard,
  selectListOrder,
  selectLists,
  selectCardsByList,
  selectCards,
  selectBoardStatus,
} from '../../slices/boardSlice';
import BoardHeader from '../../components/BoardHeader';
import BoardCanvas from '../../components/BoardCanvas';
import { useBoardCardFieldValues } from '../../../CustomFields/api';
import CardModalContainer from '../../../Card/containers/CardModal';
import BoardSettings from '../BoardSettings/BoardSettings';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/ToastRegion';
import { updateBoard, archiveBoard, deleteBoard, starBoard, unstarBoard } from '../../api';
import { createList, updateList, archiveList, deleteList, reorderLists, sortListCards, updateListColor } from '../../../List/api';
import type { ListSortBy } from '../../../List/types';
import { createCard, getCard, copyCard } from '../../../Card/api';
import { moveCard, archiveCard } from '../../api/card';
import { useWebSocket } from '../../../Realtime/hooks/useWebSocket';
import { useBoardSync } from '../../../Realtime/hooks/useBoardSync';
import { usePollingFallback } from '../../../Realtime/PollingFallback';
import { selectAuthToken, selectAuthUser } from '../../../Auth/duck/authDuck';
import { apiClient } from '~/common/api/client';
import PluginIframeContainer from '../../../Plugins/iframeHost/PluginIframeContainer';
import BoardActivitiesPanel from '../../../BoardViews/BoardActivitiesPanel';
import BoardArchivedCardsPanel from '../../../BoardViews/BoardArchivedCardsPanel';
import BoardViewSwitcher from '../../../BoardViewSwitcher/BoardViewSwitcher';
import { selectActiveView } from '../../../BoardViewSwitcher/viewPreference.slice';
import TableView from '../../../TableView/TableView';
import CalendarView from '../../../CalendarView/CalendarView';
import TimelineView from '../../../TimelineView/TimelineView';
import BoardDeleteDialog from '../../components/BoardDeleteDialog';
import ListDeleteDialog from '../../../List/components/ListDeleteDialog';
import AutomationPanel from '../../../Automation/components/AutomationPanel';
import { useAutomationPanel } from '../../../Automation/hooks/useAutomationPanel';
import BoardMembersPanel from '../../components/BoardMembersPanel';
import BoardFilterPanel, {
  type BoardFilters,
  DEFAULT_FILTERS,
  countActiveFilters,
  applyBoardFilter,
} from '../../components/BoardFilterPanel';
import { useGetBoardMembersQuery } from '../../slices/boardMembersSlice';
import { selectIsGuestInActiveWorkspace } from '~/extensions/Workspace/slices/workspaceSlice';
import {
  selectActiveWorkspaceId,
  setActiveWorkspace,
} from '~/extensions/Workspace/duck/workspaceDuck';
import { canBoardGuestWrite } from '../../mods/guestPermissions';
import { FunnelIcon } from '@heroicons/react/24/outline';
import HealthCheckTab from '~/extensions/HealthCheck/containers/HealthCheckTab/HealthCheckTab';
import { HEALTH_CHECK_ENABLED } from '~/extensions/HealthCheck/config/healthCheckConfig';
import { boardPath, cardPath } from '~/common/routing/shortUrls';

const BoardPage = () => {
  const dispatch = useAppDispatch();
  const { boardId: boardRouteId, cardId: cardRouteId } = useParams<{ boardId?: string; cardId?: string }>();
  const navigate = useNavigate();
  const [resolvedBoardId, setResolvedBoardId] = useState<string | null>(null);
  const [resolvedBoardRouteId, setResolvedBoardRouteId] = useState<string | null>(null);

  const boardId = boardRouteId ?? resolvedBoardId ?? undefined;

  const board = useAppSelector(selectBoard);
  const listOrder = useAppSelector(selectListOrder);
  const lists = useAppSelector(selectLists);
  const cardsByList = useAppSelector(selectCardsByList);
  const cards = useAppSelector(selectCards);
  const status = useAppSelector(selectBoardStatus);
  const accessToken = useAppSelector(selectAuthToken);
  const currentUser = useAppSelector(selectAuthUser);
  const activeWorkspaceId = useAppSelector(selectActiveWorkspaceId);
  const boardWorkspaceId =
    board?.workspaceId ?? (board as { workspace_id?: string } | null)?.workspace_id;
  const realtimeBoardId = board?.id ?? '';
  // Active board view type (KANBAN/TABLE/CALENDAR/TIMELINE) — managed by BoardViewSwitcher
  const activeView = useAppSelector(selectActiveView);
  // [why] GUEST workspace members can view boards but not manage settings or members.
  const isGuest = useAppSelector(selectIsGuestInActiveWorkspace);
  // [why] VIEWER guests have read-only access; MEMBER guests can write.
  // Non-guests always get full write access (canBoardGuestWrite returns true for null).
  const isViewerGuest = isGuest && !canBoardGuestWrite(board?.callerGuestType ?? null);

  // Batch-fetch custom field values for all cards on the board in a single request.
  // [why] Prevents N individual requests (one per card tile) when the board renders.
  const allCardIds = Object.keys(cards);
  const customFieldValuesMap = useBoardCardFieldValues(boardId, allCardIds);

  const listSummaries = useMemo(
    () => listOrder.map((id) => ({ id, title: lists[id]?.title ?? 'Untitled list' })),
    [listOrder, lists],
  );
  const listColors = useMemo(
    () => Object.fromEntries(Object.values(lists).map((entry) => [entry.id, entry.color ?? null])) as Record<string, string | null>,
    [lists],
  );

  // Use the shared axios client instead of a globalThis reference
  const api = apiClient;

  // /c/:cardId route: resolve the parent board first so the board page can load.
  useEffect(() => {
    if (!cardRouteId || boardRouteId) return;
    let cancelled = false;
    getCard({ api, cardId: cardRouteId })
      .then((res: { includes: { board: { id: string; short_id?: string | null } } }) => {
        if (cancelled) return;
        const resolvedId = res.includes.board.id;
        const resolvedRouteId =
          typeof res.includes.board.short_id === 'string' && res.includes.board.short_id.length > 0
            ? res.includes.board.short_id
            : resolvedId;
        setResolvedBoardId(resolvedId);
        setResolvedBoardRouteId(resolvedRouteId);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedBoardId(null);
        setResolvedBoardRouteId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api, boardRouteId, cardRouteId]);

  // ── Toast notifications ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((message: string, variant: ToastItem['variant'] | 'success' = 'error') => {
    const normalizedVariant: ToastItem['variant'] = variant === 'success' ? 'info' : variant;
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant: normalizedVariant }]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Active tab ────────────────────────────────────────────────────────────
  type BoardTab = 'board' | 'activities' | 'archived-cards' | 'health-check';
  const [activeTab, setActiveTab] = useState<BoardTab>('board');

  // ── Board settings panel ─────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Board members panel ───────────────────────────────────────────────────
  const [membersOpen, setMembersOpen] = useState(false);
  const { data: boardMembers = [] } = useGetBoardMembersQuery(boardId ?? '', { skip: !boardId });
  // [why] Joined board members are explicit board participants.
  const isBoardMember = boardMembers.some((m) => m.user_id === currentUser?.id);
  // [why] Board guests are board-scoped participants and should be able to
  //       configure and receive board notifications like joined members.
  const canManageOwnBoardNotifications = isBoardMember || isGuest;

  // ── Board filters ─────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // Reset filters when navigating to a different board
  useEffect(() => { setFilters(DEFAULT_FILTERS); setFilterPanelOpen(false); }, [boardId]);

  // Derive unique labels from cards for the filter panel label list
  const boardLabels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const card of Object.values(cards)) {
      const labels = Array.isArray(card.labels) ? card.labels : [];
      for (const label of labels) {
        if (!map.has(label.id)) map.set(label.id, { id: label.id, name: label.name, color: label.color });
      }
    }
    return Array.from(map.values());
  }, [cards]);

  // Apply all active filters to card maps
  const isFiltering = countActiveFilters(filters) > 0;
  const filteredCardsByList: Record<string, string[]> = isFiltering
    ? Object.fromEntries(
        Object.entries(cardsByList).map(([listId, cardIds]) => [
          listId,
          cardIds.filter((cardId) => {
            const card = cards[cardId];
            return card ? applyBoardFilter(card, filters, currentUser?.id) : false;
          }),
        ]),
      )
    : cardsByList;

  const filteredCards = isFiltering
    ? Object.fromEntries(
        Object.entries(cards).filter(([, card]) => applyBoardFilter(card, filters, currentUser?.id)),
      )
    : cards;

  // ── Automation panel (Sprint 65) ─────────────────────────────────────────
  const automationPanel = useAutomationPanel();

  // ── Delete confirmation dialogs (Sprint 56) ───────────────────────────────
  // Board delete: open when server returns 409 delete-requires-confirmation.
  const [boardDeleteDialog, setBoardDeleteDialog] = useState<{
    listCount: number;
    cardCount: number;
  } | null>(null);

  // List delete: open when server returns 409 for a list with cards.
  const [listDeleteDialog, setListDeleteDialog] = useState<{
    listId: string;
    listTitle: string;
    cardCount: number;
  } | null>(null);

  // ── Real-time sync (sprint-20) ────────────────────────────────────────────
  const { handleEvent, lastSequence } = useBoardSync({ boardId: realtimeBoardId });
  const { connectionState, pollingActive } = useWebSocket({
    boardId: realtimeBoardId,
    token: accessToken ?? '',
    lastSequence,
    onEvent: handleEvent,
    onMutationConflict: () =>
      addToast('A mutation conflicted with a remote change and was discarded.', 'conflict'),
    onQueueOverflow: () => {
      // Full reload on overflow so state is not stale
      if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
    },
  });

  // HTTP polling fallback: activates when WS has failed 3+ times
  usePollingFallback({
    boardId: realtimeBoardId,
    active: pollingActive,
    lastSequence,
    onEvents: (events) => { events.forEach(handleEvent); },
  });

  useEffect(() => {
    if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
  }, [dispatch, boardId]);

  useEffect(() => {
    if (!boardWorkspaceId) return;
    if (boardWorkspaceId === activeWorkspaceId) return;

    // [why] Board route has no workspace param; sync shell workspace from loaded board.
    dispatch(setActiveWorkspace(boardWorkspaceId));
  }, [activeWorkspaceId, boardWorkspaceId, dispatch]);

  // Open card modal via URL param
  const handleCardClick = useCallback(
    (cardId: string) => {
      const targetCard = cards[cardId] as { short_id?: string | null; title?: string | null } | undefined;
      navigate(cardPath({
        id: cardId,
        ...(targetCard?.short_id ? { short_id: targetCard.short_id } : {}),
        ...(targetCard?.title ? { title: targetCard.title } : {}),
      }));
    },
    [cards, navigate],
  );

  const handleRouteCardClose = useCallback(() => {
    const boardRouteTarget = (board?.short_id as string | undefined) ?? resolvedBoardRouteId ?? boardId;
    if (!boardRouteTarget) return;
    navigate(boardPath({
      id: boardRouteTarget,
      ...(board?.title ? { title: board.title } : {}),
    }));
  }, [board, resolvedBoardRouteId, boardId, navigate]);

  // ── Board title ─────────────────────────────────────────────────────────
  const handleTitleSave = useCallback(async (title: string) => {
      if (!board || !boardId) return;
      dispatch(boardSliceActions.optimisticUpdateBoardTitle({ title }));
      try {
        await updateBoard({ api, boardId, title });
      } catch {
        // Rollback — re-fetch authoritative state
        dispatch(fetchBoardDataThunk({ boardId }));
      }
    },
    [api, board, boardId, dispatch],
  );

  // ── Drag snapshot / rollback ─────────────────────────────────────────────
  const handleDragStart = useCallback(() => {
    dispatch(boardSliceActions.saveDragSnapshot());
  }, [dispatch]);

  const handleDragRollback = useCallback(() => {
    dispatch(boardSliceActions.rollbackDrag());
  }, [dispatch]);

  // ── Card move ────────────────────────────────────────────────────────────
  const handleCardMove = useCallback(
    (args: { cardId: string; fromListId: string; toListId: string; newIndex: number }) => {
      dispatch(boardSliceActions.applyOptimisticCardMove(args));
    },
    [dispatch],
  );

  // ── List reorder ─────────────────────────────────────────────────────────
  const handleListReorder = useCallback(
    (newOrder: string[]) => {
      dispatch(boardSliceActions.applyOptimisticListReorder({ newOrder }));
    },
    [dispatch],
  );

  // ── Drag commit (API call after successful drag) ─────────────────────────
  const handleDragCommit = useCallback(
    async (args: {
      type: 'card' | 'list';
      cardId?: string;
      fromListId?: string;
      toListId?: string;
      afterCardId?: string | null;
      newListOrder?: string[];
    }) => {
      if (!boardId) return;
      if (args.type === 'card' && args.cardId && args.toListId) {
        const result = await moveCard({
          api,
          cardId: args.cardId,
          targetListId: args.toListId,
          afterCardId: args.afterCardId ?? null,
        });
        if (args.fromListId) {
          dispatch(
            boardSliceActions.remoteCardMove({
              card: {
                id: result.data.id,
                list_id: result.data.list_id,
                position: result.data.position,
              },
              fromListId: args.fromListId,
            }),
          );
        }
        dispatch(boardSliceActions.clearDragSnapshot());
      } else if (args.type === 'list' && args.newListOrder) {
        await reorderLists({ api, boardId, order: args.newListOrder });
        dispatch(boardSliceActions.clearDragSnapshot());
      }
    },
    [api, boardId, dispatch],
  );

  // ── Inline card creation ─────────────────────────────────────────────────
  const handleAddCard = useCallback(
    async (listId: string, title: string) => {
      const result = await createCard({ api, listId, title });
      dispatch(boardSliceActions.addCard({ card: result.data }));
    },
    [api, dispatch],
  );

  // ── Inline list creation ─────────────────────────────────────────────────
  const handleAddList = useCallback(
    async (title: string) => {
      if (!boardId) return;
      const result = await createList({ api, boardId, title });
      dispatch(boardSliceActions.addList({ list: result.data }));
    },
    [api, boardId, dispatch],
  );

  // ── List rename ──────────────────────────────────────────────────────────
  const handleRenameList = useCallback(
    (listId: string, title: string) => {
      // Optimistic: update local state; fire API in background
      updateList({ api, listId, title }).catch(() => {
        // On failure, re-fetch to restore authoritative state
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
      });
    },
    [api, boardId, dispatch],
  );

  // ── List archive / delete ────────────────────────────────────────────────
  const handleArchiveList = useCallback(
    async (listId: string) => {
      try {
        await archiveList({ api, listId });
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
      } catch {
        // TODO: surface error to user
      }
    },
    [api, boardId, dispatch],
  );

  const handleDeleteList = useCallback(
    async (listId: string) => {
      try {
        await deleteList({ api, listId });
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
      } catch (err: unknown) {
        // 409 means the list has cards — open confirmation dialog.
        const resp = (err as { response?: { status?: number; data?: { name?: string; data?: { cardCount?: number } } } }).response;
        if (resp?.status === 409 && resp.data?.name === 'delete-requires-confirmation') {
          const listTitle = lists[listId]?.title ?? 'this list';
          setListDeleteDialog({
            listId,
            listTitle,
            cardCount: resp.data.data?.cardCount ?? 0,
          });
        } else {
          addToast('Failed to delete list.', 'error');
        }
      }
    },
    [api, boardId, dispatch, lists, addToast],
  );

  const handleSortList = useCallback(
    async (listId: string, sortBy: ListSortBy) => {
      dispatch(boardSliceActions.sortCardsInList({ listId, sortBy }));
      try {
        const response = await sortListCards({ api, listId, sortBy });
        dispatch(boardSliceActions.applySortedListFromServer({ listId, cards: response.data }));
      } catch {
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
        addToast('Failed to sort list.', 'error');
      }
    },
    [addToast, api, boardId, dispatch],
  );

  const handleChangeListColor = useCallback(
    async (listId: string, color: string | null) => {
      const list = lists[listId];
      if (!list) return;

      dispatch(boardSliceActions.updateList({ list: { ...list, color } }));
      try {
        await updateListColor({ api, listId, color });
      } catch {
        if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
        addToast('Failed to update list color.', 'error');
      }
    },
    [addToast, api, boardId, dispatch, lists],
  );

  const handleMoveList = useCallback(
    async (listId: string, targetIndex: number) => {
      if (!boardId) return;
      const currentIndex = listOrder.indexOf(listId);
      if (currentIndex === -1) return;

      const without = listOrder.filter((id) => id !== listId);
      const normalizedTarget = Math.max(0, Math.min(targetIndex, listOrder.length - 1));
      const newOrder = [...without];
      newOrder.splice(normalizedTarget, 0, listId);

      dispatch(boardSliceActions.applyOptimisticListReorder({ newOrder }));
      try {
        await reorderLists({ api, boardId, order: newOrder });
      } catch {
        dispatch(fetchBoardDataThunk({ boardId }));
        addToast('Failed to move list.', 'error');
      }
    },
    [addToast, api, boardId, dispatch, listOrder],
  );

  const handleMoveAllCards = useCallback(
    async (fromListId: string, targetListId: string) => {
      if (!boardId || fromListId === targetListId) return;
      const sourceCardIds = [...(cardsByList[fromListId] ?? [])];
      if (sourceCardIds.length === 0) return;

      const targetCardIds = cardsByList[targetListId] ?? [];
      let afterCardId: string | null = null;
      if (targetCardIds.length > 0) {
        const lastIndex = targetCardIds.length - 1;
        const tailCardId = targetCardIds[lastIndex];
        afterCardId = tailCardId ?? null;
      }

      try {
        for (const cardId of sourceCardIds) {
          await moveCard({ api, cardId, targetListId, afterCardId });
          // Chain moves so cards keep their original relative order in the destination list.
          afterCardId = cardId;
        }
        dispatch(fetchBoardDataThunk({ boardId }));
      } catch {
        dispatch(fetchBoardDataThunk({ boardId }));
        addToast('Failed to move all cards.', 'error');
      }
    },
    [addToast, api, boardId, cardsByList, dispatch],
  );

  const handleArchiveAllCards = useCallback(
    async (listId: string) => {
      if (!boardId) return;
      const cardIds = cardsByList[listId] ?? [];
      if (cardIds.length === 0) return;
      try {
        await Promise.all(cardIds.map((cardId) => archiveCard({ api, cardId })));
        dispatch(fetchBoardDataThunk({ boardId }));
      } catch {
        dispatch(fetchBoardDataThunk({ boardId }));
        addToast('Failed to archive all cards in this list.', 'error');
      }
    },
    [addToast, api, boardId, cardsByList, dispatch],
  );

  const handleCopyList = useCallback(
    async (listId: string) => {
      if (!boardId) return;
      const sourceList = lists[listId];
      if (!sourceList) return;
      try {
        const created = await createList({
          api,
          boardId,
          title: `${sourceList.title} (Copy)`,
          afterId: listId,
        });
        const sourceCardIds = cardsByList[listId] ?? [];
        for (const cardId of sourceCardIds) {
          await copyCard({
            api,
            cardId,
            targetListId: created.data.id,
            keepChecklists: true,
            keepMembers: true,
          });
        }
        dispatch(fetchBoardDataThunk({ boardId }));
      } catch {
        addToast('Failed to copy list.', 'error');
      }
    },
    [addToast, api, boardId, cardsByList, dispatch, lists],
  );

  // ── Board archive / delete ─────────────────────────────────────────────
  const handleBoardArchive = useCallback(async () => {
    if (!boardId || !board) return;
    try {
      await archiveBoard({ api, boardId });
      dispatch(fetchBoardDataThunk({ boardId }));
    } catch {
      addToast('Failed to archive board.', 'error');
    }
  }, [api, board, boardId, dispatch, addToast]);

  const handleBoardDelete = useCallback(async () => {
    if (!boardId) return;
    try {
      await deleteBoard({ api, boardId });
      // Close all open panels before navigating away so they don't flash on unmount.
      setSettingsOpen(false);
      setMembersOpen(false);
      automationPanel.closePanel();
      navigate(`/workspace/${board?.workspaceId}/boards`, {
        state: { successToast: 'Board deleted' },
      });
    } catch (err: unknown) {
      // 409 means the board has lists/cards — open confirmation dialog.
      const resp = (err as { response?: { status?: number; data?: { name?: string; data?: { listCount?: number; cardCount?: number } } } }).response;
      if (resp?.status === 409 && resp.data?.name === 'delete-requires-confirmation') {
        setBoardDeleteDialog({
          listCount: resp.data.data?.listCount ?? 0,
          cardCount: resp.data.data?.cardCount ?? 0,
        });
      } else {
        addToast('Failed to delete board.', 'error');
      }
    }
  }, [api, boardId, board, navigate, addToast, automationPanel]);

  // ── Star / unstar board ────────────────────────────────────────────────
  const [starredOverride, setStarredOverride] = useState<boolean | null>(null);

  // [why] Reset override when navigating to a different board so the fresh
  // isStarred value from the server is used rather than the previous board's state.
  useEffect(() => { setStarredOverride(null); }, [boardId]);

  const handleStar = useCallback(async () => {
    if (!boardId) return;
    setStarredOverride(true);
    try {
      await starBoard({ api, boardId });
    } catch {
      setStarredOverride(null);
      addToast('Failed to star board.', 'error');
    }
  }, [api, boardId, addToast]);

  const handleUnstar = useCallback(async () => {
    if (!boardId) return;
    setStarredOverride(false);
    try {
      await unstarBoard({ api, boardId });
    } catch {
      setStarredOverride(null);
      addToast('Failed to unstar board.', 'error');
    }
  }, [api, boardId, addToast]);

  if (status === 'loading' && !board) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <p className="text-muted">Loading board…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base">
        <p className="text-danger">Failed to load board.</p>
      </div>
    );
  }

  if (!board) return null;

  const tabs = [
    { id: 'board' as const, label: 'Board' },
    { id: 'activities' as const, label: 'Activities' },
    { id: 'archived-cards' as const, label: 'Archived Cards' },
    // Health Check tab — only visible when feature flag is enabled (Sprint 116)
    ...(HEALTH_CHECK_ENABLED ? [{ id: 'health-check' as const, label: 'Health Check' }] : []),
  ];

  return (
    <div
      className="flex flex-col text-base h-full overflow-hidden relative bg-bg-base bg-cover bg-center"
      style={board.background ? { backgroundImage: `url(${board.background})` } : undefined}
    >
      {/* Dark scrim over background image so text stays legible */}
      {board.background && (
        <div className="absolute inset-0 bg-black/50 pointer-events-none z-0" aria-hidden="true" />
      )}
      {/* All content above the scrim */}
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
      {/* Unified glass block — one frosted surface using theme tokens so dark mode works */}
      {/* WHY: relative z-10 ensures this stacking context paints above the BoardCanvas sibling,
          preventing the header dropdown from being hidden behind kanban column elements */}
      <div className={`relative z-10 border-b border-border${board.background ? ' bg-bg-surface/75 backdrop-blur-2xl' : ' bg-bg-surface'}`}>
      <BoardHeader
        board={starredOverride === null ? board : { ...board, isStarred: starredOverride }}
        members={boardMembers.map((m) => ({ id: m.user_id, display_name: m.display_name, email: m.email, avatar_url: m.avatar_url }))}
        connectionState={connectionState}
        pollingActive={pollingActive}
        onTitleSave={handleTitleSave}
        onOpenAutomation={automationPanel.openPanel}
        hasBackground={!!board.background}
        useParentGlass={!!board.background}
        isGuest={isGuest}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMembers={() => setMembersOpen(true)}
        {...(!isGuest && {
          onArchive: handleBoardArchive,
          onDelete: handleBoardDelete,
        })}
        onStar={handleStar}
        onUnstar={handleUnstar}
      />
      {board.state === 'ARCHIVED' && (
        <div className="mx-6 mt-1 rounded border border-yellow-700 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-400">
          This board is archived and read-only.
        </div>
      )}

      {/* Nav row: primary tabs on the left, view switcher on the right */}
      <div className="flex items-center px-6 pb-0">
        {/* Primary navigation group */}
        <div className="flex items-center">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            // Underline-only active state — no background pills
            const tabClass = isActive
              ? (board.background ? 'text-white font-medium border-b-2 border-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]' : 'text-primary font-medium border-b-2 border-primary')
              : (board.background ? 'text-white/80 border-b-2 border-transparent hover:text-white hover:bg-white/15 rounded transition-colors [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]' : 'text-muted border-b-2 border-transparent hover:text-base transition-colors');
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2.5 text-sm font-medium ${tabClass}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Thin divider + view switcher + filter button — only on Board tab */}
        {activeTab === 'board' && (
          <>
            <div className={`mx-4 h-4 w-px flex-shrink-0 ${board.background ? 'bg-white/30' : 'bg-border'}`} aria-hidden="true" />
            <BoardViewSwitcher boardId={boardId ?? ''} hasBackground={!!board.background} segmented />
            <div ref={filterContainerRef} className="relative ml-2">
              {/* Filter button — shows active filter count as a badge */}
              {(() => {
                const activeCount = countActiveFilters(filters);
                const hasActiveFilters = activeCount > 0;
                const btnBase = 'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary';
                let btnVariant: string;
                if (hasActiveFilters && board.background) {
                  btnVariant = 'bg-white/25 text-white hover:bg-white/30';
                } else if (hasActiveFilters) {
                  btnVariant = 'bg-bg-overlay text-base hover:bg-bg-sunken';
                } else if (board.background) {
                  btnVariant = 'text-white/80 hover:text-white hover:bg-white/15';
                } else {
                  btnVariant = 'text-muted hover:text-base hover:bg-bg-overlay';
                }
                const badgeClass = board.background
                  ? 'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none bg-white/30 text-white'
                  : 'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none bg-primary text-white';
                return (
                  <button
                    type="button"
                    onClick={() => setFilterPanelOpen((v) => !v)}
                    className={`${btnBase} ${btnVariant}`}
                  >
                    <FunnelIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Filter
                    {hasActiveFilters && (
                      <span className={badgeClass}>{activeCount}</span>
                    )}
                  </button>
                );
              })()}
              {filterPanelOpen && (
                <BoardFilterPanel
                  containerRef={filterContainerRef}
                  onClose={() => setFilterPanelOpen(false)}
                  filters={filters}
                  onChange={setFilters}
                  boardMembers={boardMembers}
                  boardLabels={boardLabels}
                  {...(currentUser?.id ? { currentUserId: currentUser.id } : {})}
                />
              )}
            </div>
          </>
        )}
      </div>
      </div>

      {/* Tab content */}
      {activeTab === 'board' ? (
        /* Hidden plugin iframes + bridge provider for card plugin UI injections */
        <div className="flex flex-col flex-1 overflow-hidden">
        <PluginIframeContainer boardId={boardId ?? ''}>
          {/* Render the active view */}
          {activeView === 'KANBAN' ? (
            <BoardCanvas
              boardId={boardId ?? ''}
              boardTitle={board.title}
              listOrder={listOrder}
              lists={lists}
              cardsByList={filteredCardsByList}
              cards={filteredCards}
              onCardMove={handleCardMove}
              onListReorder={handleListReorder}
              onDragStart={handleDragStart}
              onDragCommit={handleDragCommit}
              onDragRollback={handleDragRollback}
              onAddCard={handleAddCard}
              onAddList={handleAddList}
              onRenameList={handleRenameList}
              onCopyList={handleCopyList}
              onMoveList={handleMoveList}
              onMoveAllCards={handleMoveAllCards}
              onArchiveList={handleArchiveList}
              onArchiveAllCards={handleArchiveAllCards}
              onDeleteList={handleDeleteList}
              onChangeListColor={handleChangeListColor}
              onSortList={handleSortList}
              listColors={listColors}
              listSummaries={listSummaries}
              onCardClick={handleCardClick}
              isReadOnly={board.state === 'ARCHIVED'}
              isViewerGuest={isViewerGuest}
              customFieldValuesMap={customFieldValuesMap}
              hasBackground={!!board.background}
              collapseEmptyLists={filters.collapseLists && isFiltering}
            />
          ) : activeView === 'TABLE' ? (
            <TableView
              cards={Object.values(filteredCards)}
              lists={lists}
              onCardClick={handleCardClick}
            />
          ) : activeView === 'CALENDAR' ? (
            <CalendarView
              cards={Object.values(filteredCards)}
              lists={lists}
              onCardClick={handleCardClick}
              addToast={addToast}
            />
          ) : activeView === 'TIMELINE' ? (
            <TimelineView
              cards={Object.values(filteredCards)}
              lists={lists}
              onCardClick={handleCardClick}
              addToast={addToast}
            />
          ) : null}
          {/* Automation panel (Sprint 65) */}
          <AutomationPanel
            boardId={boardId ?? ''}
            isOpen={automationPanel.isOpen}
            activeTab={automationPanel.activeTab}
            onClose={automationPanel.closePanel}
            onTabChange={automationPanel.setActiveTab}
          />
          {/* Toast notifications (rollback errors, conflicts) */}
          <ToastRegion toasts={toasts} onDismiss={dismissToast} />
        </PluginIframeContainer>
        </div>
      ) : activeTab === 'activities' ? (
        <div className={`flex-1 overflow-y-auto${board.background ? ' px-6 py-4' : ''}`}>
          <div className={board.background ? 'bg-bg-surface rounded-xl min-h-full' : ''}>
            <BoardActivitiesPanel boardId={boardId ?? ''} onCardClick={handleCardClick} />
          </div>
        </div>
      ) : activeTab === 'health-check' ? (
        <HealthCheckTab boardId={boardId ?? ''} />
      ) : (
        <div className={`flex-1 overflow-y-auto${board.background ? ' px-6 py-4' : ''}`}>
          <div className={board.background ? 'bg-bg-surface rounded-xl min-h-full' : ''}>
          <BoardArchivedCardsPanel
            boardId={boardId ?? ''}
            onCardUnarchived={() => {
              if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
              setActiveTab('board');
            }}
          />
          </div>
        </div>
      )}

      {/* Card detail modal — always mounted so ?card= links work from any tab */}
      <CardModalContainer
        {...(cardRouteId ? { forcedCardId: cardRouteId } : {})}
        {...(cardRouteId ? { onCloseCard: handleRouteCardClose } : {})}
      />

      {/* Board settings panel */}
      {settingsOpen && (
        <BoardSettings
          onClose={() => setSettingsOpen(false)}
          isGuest={isGuest}
          isViewerGuest={isViewerGuest}
          isBoardParticipant={canManageOwnBoardNotifications}
        />
      )}
      {/* Board members panel (Sprint 79) */}
      {membersOpen && (
        <BoardMembersPanel onClose={() => setMembersOpen(false)} isGuest={isGuest} />
      )}

      {/* Board delete confirmation dialog — shown when server returns 409 with nested content counts */}
      {boardDeleteDialog && (
        <BoardDeleteDialog
          boardTitle={board.title}
          listCount={boardDeleteDialog.listCount}
          cardCount={boardDeleteDialog.cardCount}
          onConfirm={async () => {
            setBoardDeleteDialog(null);
            try {
              await deleteBoard({ api, boardId: boardId!, confirm: true });
              setSettingsOpen(false);
              setMembersOpen(false);
              automationPanel.closePanel();
              navigate(`/workspace/${board.workspaceId}/boards`, {
                state: { successToast: 'Board deleted' },
              });
            } catch {
              addToast('Failed to delete board.', 'error');
            }
          }}
          onCancel={() => setBoardDeleteDialog(null)}
        />
      )}

      {/* List delete confirmation dialog — shown when server returns 409 for a list with cards */}
      {listDeleteDialog && (
        <ListDeleteDialog
          listTitle={listDeleteDialog.listTitle}
          cardCount={listDeleteDialog.cardCount}
          onConfirm={async () => {
            const { listId } = listDeleteDialog;
            setListDeleteDialog(null);
            await deleteList({ api, listId, confirm: true });
            if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
          }}
          onCancel={() => setListDeleteDialog(null)}
        />
      )}
    </div>
    </div>
  );
};

export default BoardPage;
