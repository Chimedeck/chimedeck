// BoardPage — renders a single board with lists and cards as a kanban view.
// Sprint 18: uses boardSlice (DndContext via BoardCanvas, optimistic card/list drag).
// Sprint 19: ?card=:id URL param opens CardModal.
// Sprint 20: real-time sync via useWebSocket + useBoardSync; ConnectionBadge in header.
// Sprint 48: tabbed view adds Activity, Comments, and Archived Cards panels.
// Sprint 52: BoardViewSwitcher mounted above canvas for Kanban/Table/Calendar/Timeline.
// Sprint 56: replace browser confirm() with BoardDeleteDialog/ListDeleteDialog for nested content.
// Sprint 87: redirect to workspace boards page (with success toast via navigate state) when the currently open board is deleted.
// Sprint 116: Health Check fifth tab (HEALTH_CHECK_ENABLED flag).
import { useEffect, useCallback, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
} from '../../slices/boardSlice';import BoardHeader from '../../components/BoardHeader';
import BoardCanvas from '../../components/BoardCanvas';
import { useBoardCardFieldValues } from '../../../CustomFields/api';
import CardModalContainer from '../../../Card/containers/CardModal';
import BoardSettings from '../BoardSettings/BoardSettings';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/ToastRegion';
import { updateBoard, archiveBoard, deleteBoard } from '../../api';
import { createList, updateList, archiveList, deleteList, reorderLists } from '../../../List/api';
import { createCard } from '../../../Card/api';
import { moveCard } from '../../api/card';
import { useWebSocket } from '../../../Realtime/hooks/useWebSocket';
import { useBoardSync } from '../../../Realtime/hooks/useBoardSync';
import { usePollingFallback } from '../../../Realtime/PollingFallback';
import { selectAuthToken } from '../../../Auth/duck/authDuck';
import { apiClient } from '~/common/api/client';
import PluginIframeContainer from '../../../Plugins/iframeHost/PluginIframeContainer';
import BoardActivityPanel from '../../../BoardViews/BoardActivityPanel';
import BoardCommentsPanel from '../../../BoardViews/BoardCommentsPanel';
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
import { useGetBoardMembersQuery } from '../../slices/boardMembersSlice';
import { selectIsGuestInActiveWorkspace } from '~/extensions/Workspace/slices/workspaceSlice';
import { canBoardGuestWrite } from '../../mods/guestPermissions';
import type { BoardSearchResult } from '~/extensions/Search/api';
import HealthCheckTab from '~/extensions/HealthCheck/containers/HealthCheckTab/HealthCheckTab';
import { HEALTH_CHECK_ENABLED } from '~/extensions/HealthCheck/config/healthCheckConfig';

// Injected by app bootstrap (same pattern as other containers)
declare const __api__: {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, data: unknown) => Promise<T>;
  patch: <T>(url: string, data?: unknown) => Promise<T>;
  delete: <T>(url: string) => Promise<T>;
};

const BoardPage = () => {
  const dispatch = useAppDispatch();
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Board-scoped search state ─────────────────────────────────────────────
  // Restore search query from URL on mount; reset when boardId changes.
  const initialBoardSearch = searchParams.get('boardSearch') ?? '';

  const board = useAppSelector(selectBoard);
  const listOrder = useAppSelector(selectListOrder);
  const lists = useAppSelector(selectLists);
  const cardsByList = useAppSelector(selectCardsByList);
  const cards = useAppSelector(selectCards);
  const status = useAppSelector(selectBoardStatus);
  const accessToken = useAppSelector(selectAuthToken);
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

  // Use the shared axios client instead of a globalThis reference
  const api = apiClient;

  // ── Toast notifications ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((message: string, variant: ToastItem['variant'] = 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Active tab ────────────────────────────────────────────────────────────
  type BoardTab = 'board' | 'activity' | 'comments' | 'archived-cards' | 'health-check';
  const [activeTab, setActiveTab] = useState<BoardTab>('board');

  // ── Board settings panel ─────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Board members panel ───────────────────────────────────────────────────
  const [membersOpen, setMembersOpen] = useState(false);
  const { data: boardMembers = [] } = useGetBoardMembersQuery(boardId ?? '', { skip: !boardId });

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
  const { handleEvent, lastSequence } = useBoardSync({ boardId: boardId ?? '' });
  const { connectionState, pollingActive } = useWebSocket({
    boardId: boardId ?? '',
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
    boardId: boardId ?? '',
    active: pollingActive,
    lastSequence,
    onEvents: (events) => { events.forEach(handleEvent); },
  });

  useEffect(() => {
    if (boardId) dispatch(fetchBoardDataThunk({ boardId }));
  }, [dispatch, boardId]);

  // Open card modal via URL param
  const handleCardClick = useCallback(
    (cardId: string) => {
      setSearchParams((p) => {
        const next = new URLSearchParams(p);
        next.set('card', cardId);
        return next;
      });
    },
    [setSearchParams],
  );

  // ── Board search result selection ────────────────────────────────────────
  // Card results: open the card modal via the ?card= URL param.
  // List results: scroll the list column into view.
  const handleSearchResultSelect = useCallback(
    (result: BoardSearchResult) => {
      if (result.type === 'card') {
        handleCardClick(result.id);
      } else {
        const el = document.getElementById(`board-list-${result.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        el?.focus({ preventScroll: true });
      }
    },
    [handleCardClick],
  );

  // Sync the active search query into the URL as ?boardSearch= so it survives refresh.
  // An empty string removes the param entirely to keep URLs clean.
  const handleSearchQueryChange = useCallback(
    (query: string) => {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (query) {
            next.set('boardSearch', query);
          } else {
            next.delete('boardSearch');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

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
        await moveCard({
          api,
          cardId: args.cardId,
          targetListId: args.toListId,
          afterCardId: args.afterCardId ?? null,
        });
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

  // ── Render ───────────────────────────────────────────────────────────────

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
    { id: 'activity' as const, label: 'Activity' },
    { id: 'comments' as const, label: 'Comments' },
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
      <div className={`border-b border-border${board.background ? ' bg-bg-surface/75 backdrop-blur-2xl' : ' bg-bg-surface'}`}>
      <BoardHeader
        board={board}
        members={boardMembers.map((m) => ({ id: m.user_id, display_name: m.display_name, email: m.email, avatar_url: m.avatar_url }))}
        connectionState={connectionState}
        pollingActive={pollingActive}
        onTitleSave={handleTitleSave}
        onOpenAutomation={automationPanel.openPanel}
        hasBackground={!!board.background}
        useParentGlass={!!board.background}
        isGuest={isGuest}
        {...(accessToken ? { searchToken: accessToken } : {})}
        {...(initialBoardSearch ? { initialSearchQuery: initialBoardSearch } : {})}
        onSearchResultSelect={handleSearchResultSelect}
        onSearchQueryChange={handleSearchQueryChange}
        {...(!isGuest && {
          onArchive: handleBoardArchive,
          onDelete: handleBoardDelete,
          onOpenSettings: () => setSettingsOpen(true),
          onOpenMembers: () => setMembersOpen(true),
        })}
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
                className={`px-3 py-2.5 text-sm ${tabClass}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Thin divider + view switcher — only on Board tab */}
        {activeTab === 'board' && (
          <>
            <div className={`mx-4 h-4 w-px flex-shrink-0 ${board.background ? 'bg-white/30' : 'bg-border'}`} aria-hidden="true" />
            <BoardViewSwitcher boardId={boardId ?? ''} hasBackground={!!board.background} segmented />
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
              cardsByList={cardsByList}
              cards={cards}
              onCardMove={handleCardMove}
              onListReorder={handleListReorder}
              onDragStart={handleDragStart}
              onDragCommit={handleDragCommit}
              onDragRollback={handleDragRollback}
              onAddCard={handleAddCard}
              onAddList={handleAddList}
              onRenameList={handleRenameList}
              onArchiveList={handleArchiveList}
              onDeleteList={handleDeleteList}
              onCardClick={handleCardClick}
              isReadOnly={board.state === 'ARCHIVED'}
              isViewerGuest={isViewerGuest}
              customFieldValuesMap={customFieldValuesMap}
              hasBackground={!!board.background}
            />
          ) : activeView === 'TABLE' ? (
            <TableView
              cards={Object.values(cards)}
              lists={lists}
              onCardClick={handleCardClick}
            />
          ) : activeView === 'CALENDAR' ? (
            <CalendarView
              cards={Object.values(cards)}
              lists={lists}
              onCardClick={handleCardClick}
              addToast={addToast}
            />
          ) : activeView === 'TIMELINE' ? (
            <TimelineView
              cards={Object.values(cards)}
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
      ) : activeTab === 'activity' ? (
        <div className={`flex-1 overflow-y-auto${board.background ? ' px-6 py-4' : ''}`}>
          <div className={board.background ? 'bg-bg-surface rounded-xl min-h-full' : ''}>
            <BoardActivityPanel boardId={boardId ?? ''} />
          </div>
        </div>
      ) : activeTab === 'comments' ? (
        <div className={`flex-1 overflow-y-auto${board.background ? ' px-6 py-4' : ''}`}>
          <div className={board.background ? 'bg-bg-surface rounded-xl min-h-full' : ''}>
            <BoardCommentsPanel boardId={boardId ?? ''} />
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
      <CardModalContainer />

      {/* Board settings panel */}
      {settingsOpen && (
        <BoardSettings
          onClose={() => setSettingsOpen(false)}
          isGuest={isGuest}
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
