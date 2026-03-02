// BoardPage — renders a single board with lists and cards.
// Lists are wired to drag-and-drop reorder via useListReorder (sprint 06).
import { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Page from '~/components/Page';
import TopbarContainer from '~/containers/TopbarContainer/TopbarContainer';
import FooterContainer from '~/containers/FooterContainer/FooterContainer';
import LayoutSingleColumn from '~/layout/LayoutSingleColumn';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import BoardStateChip from '../../components/BoardStateChip';
import {
  boardSelector,
  boardIncludesSelector,
  fetchBoardInProgressSelector,
  fetchBoardErrorSelector,
  fetchBoardThunk,
} from './BoardPage.duck';
import DraggableListColumn from '../../../List/containers/BoardPage/ListColumn';
import AddListButton from '../../../List/components/AddListButton';
import { useListReorder } from '../../../List/hooks/useListReorder';
import {
  createList,
  updateList,
  archiveList,
  deleteList,
} from '../../../List/api';

// Injected via the app-level API singleton (same pattern as other containers)
declare const __api__: {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, data: unknown) => Promise<T>;
  patch: <T>(url: string, data?: unknown) => Promise<T>;
  delete: <T>(url: string) => Promise<T>;
};

const BoardPage = () => {
  const dispatch = useAppDispatch();
  const { boardId } = useParams<{ boardId: string }>();

  const board = useAppSelector(boardSelector);
  const includes = useAppSelector(boardIncludesSelector);
  const loading = useAppSelector(fetchBoardInProgressSelector);
  const error = useAppSelector(fetchBoardErrorSelector);

  // TODO: replace __api__ with the injected api from the store extra
  // For now we declare an inline stub that mirrors how other containers consume it.
  const api = (globalThis as unknown as { __api__: typeof __api__ }).__api__;

  const { lists, setInitialLists, move, error: reorderError } = useListReorder({
    api,
    boardId: boardId ?? '',
  });

  const dragSourceIndex = useRef<number | null>(null);

  useEffect(() => {
    if (boardId) dispatch(fetchBoardThunk({ boardId }));
  }, [dispatch, boardId]);

  // Sync lists from store into the reorder hook when the board loads
  useEffect(() => {
    if (includes.lists.length > 0) setInitialLists(includes.lists);
  }, [includes.lists, setInitialLists]);

  const handleAddList = useCallback(
    async (title: string) => {
      if (!boardId) return;
      try {
        await createList({ api, boardId, title });
        dispatch(fetchBoardThunk({ boardId }));
      } catch {
        // TODO: surface error to user
      }
    },
    [api, boardId, dispatch],
  );

  const handleRename = useCallback(
    async (listId: string, title: string) => {
      try {
        await updateList({ api, listId, title });
        if (boardId) dispatch(fetchBoardThunk({ boardId }));
      } catch {
        // TODO: surface error to user
      }
    },
    [api, boardId, dispatch],
  );

  const handleArchive = useCallback(
    async (listId: string) => {
      try {
        await archiveList({ api, listId });
        if (boardId) dispatch(fetchBoardThunk({ boardId }));
      } catch {
        // TODO: surface error to user
      }
    },
    [api, boardId, dispatch],
  );

  const handleDelete = useCallback(
    async (listId: string) => {
      if (!confirm('Are you sure you want to delete this list? All cards will be removed.')) return;
      try {
        await deleteList({ api, listId });
        if (boardId) dispatch(fetchBoardThunk({ boardId }));
      } catch {
        // TODO: surface error to user
      }
    },
    [api, boardId, dispatch],
  );

  const pageContent = (() => {
    if (loading) return <p className="text-gray-500">Loading board…</p>;
    if (error) return <p className="text-red-600">Failed to load board.</p>;
    if (!board) return null;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{board.title}</h1>
          <BoardStateChip state={board.state} />
        </div>
        {board.state === 'ARCHIVED' && (
          <p className="rounded border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            This board is archived and read-only.
          </p>
        )}
        {reorderError && (
          <p className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
            {reorderError}
          </p>
        )}
        {/* Board columns — horizontal scrollable kanban row */}
        <div
          className="flex gap-4 overflow-x-auto pb-4"
          role="list"
          aria-label="Board lists"
        >
          {lists.map((list, index) => (
            <DraggableListColumn
              key={list.id}
              list={list}
              index={index}
              onDragStart={(i) => { dragSourceIndex.current = i; }}
              onDrop={(toIndex) => {
                if (dragSourceIndex.current !== null) {
                  move(dragSourceIndex.current, toIndex);
                  dragSourceIndex.current = null;
                }
              }}
              onRename={handleRename}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
          {board.state !== 'ARCHIVED' && (
            <AddListButton onAdd={handleAddList} />
          )}
        </div>
      </div>
    );
  })();

  return (
    <Page title={board?.title ?? 'Board'}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
      >
        <div className="mx-auto max-w-full px-4 py-6">{pageContent}</div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BoardPage;
