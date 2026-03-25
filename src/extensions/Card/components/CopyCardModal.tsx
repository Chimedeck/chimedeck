// CopyCardModal — dialog to copy a card to any board/list/position with optional data retention.
// [why] Uses a nested Radix Dialog instead of a raw createPortal div so that
// Radix's FocusScope stack properly hands off focus from the card modal to this
// dialog and back — a plain portal div would have its inputs stolen by the outer
// FocusScope.
import { useEffect, useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { XMarkIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import type { Board } from '../../Board/api';
import type { List } from '../../List/api';
import { copyCard, type Card } from '../api';

interface Props {
  cardId: string;
  cardTitle: string;
  checklistCount: number;
  memberCount: number;
  currentBoardId: string;
  currentListId: string;
  workspaceId: string;
  api: {
    get: <T>(url: string) => Promise<T>;
    post: <T>(url: string, data: unknown) => Promise<T>;
  };
  onClose: () => void;
  onSuccess: (card: Card) => void;
}

const CopyCardModal = ({
  cardId,
  cardTitle,
  checklistCount,
  memberCount,
  currentBoardId,
  currentListId,
  workspaceId,
  api,
  onClose,
  onSuccess,
}: Props) => {
  const [title, setTitle] = useState(`${cardTitle} (copy)`);
  const [keepChecklists, setKeepChecklists] = useState(checklistCount > 0);
  const [keepMembers, setKeepMembers] = useState(memberCount > 0);

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState(currentBoardId);

  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState(currentListId);

  // cardCount[listId] = number of non-archived cards in that list
  const [cardCountsByList, setCardCountsByList] = useState<Record<string, number>>({});
  const [selectedPosition, setSelectedPosition] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch boards once on mount
  useEffect(() => {
    api
      .get<{ data: Board[] }>(`/workspaces/${workspaceId}/boards`)
      .then(({ data }) => {
        const active = data.filter((b) => b.state === 'ACTIVE' || !('state' in b));
        setBoards(active);
      })
      .catch(() => {});
  }, [api, workspaceId]);

  // Fetch lists (+ card counts) when board selection changes
  const fetchBoardData = useCallback(
    async (boardId: string) => {
      try {
        const [listsRes, boardRes] = await Promise.all([
          api.get<{ data: List[] }>(`/boards/${boardId}/lists`),
          api.get<{ data: Board; includes: { lists: unknown[]; cards: Array<{ list_id: string; archived: boolean }> } }>(
            `/boards/${boardId}`,
          ),
        ]);

        const nonArchivedLists = listsRes.data.filter((l) => !l.archived);
        setLists(nonArchivedLists);

        // Count non-archived cards per list
        const counts: Record<string, number> = {};
        for (const card of boardRes.includes.cards) {
          if (!card.archived) {
            counts[card.list_id] = (counts[card.list_id] ?? 0) + 1;
          }
        }
        setCardCountsByList(counts);

        // When board changes, default to first list (or keep current if same board)
        const defaultList =
          boardId === currentBoardId
            ? nonArchivedLists.find((l) => l.id === currentListId) ?? nonArchivedLists[0]
            : nonArchivedLists[0];

        if (defaultList) {
          setSelectedListId(defaultList.id);
          const count = counts[defaultList.id] ?? 0;
          setSelectedPosition(count + 1);
        }
      } catch {
        setLists([]);
        setCardCountsByList({});
      }
    },
    [api, currentBoardId, currentListId],
  );

  useEffect(() => {
    fetchBoardData(selectedBoardId);
  }, [selectedBoardId, fetchBoardData]);

  // Update position range when list changes
  const handleListChange = (listId: string) => {
    setSelectedListId(listId);
    const count = cardCountsByList[listId] ?? 0;
    setSelectedPosition(count + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await copyCard({
        api,
        cardId,
        targetListId: selectedListId,
        position: selectedPosition,
        title: title.trim() || cardTitle,
        keepChecklists,
        keepMembers,
      });
      onSuccess(result.data);
    } catch {
      setError('Failed to copy card. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const maxPosition = (cardCountsByList[selectedListId] ?? 0) + 1;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50" />
        <Dialog.Content
          className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          onInteractOutside={(e) => { e.preventDefault(); onClose(); }}
          onEscapeKeyDown={onClose}
          aria-label="Copy card"
        >
          <Dialog.Title className="sr-only">Copy card</Dialog.Title>
          <div className="relative w-80 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Copy card</h2>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-slate-400 transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="copy-card-title" className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              Name
            </label>
            <input
              id="copy-card-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Keep... section */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-2">Keep...</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepChecklists}
                  onChange={(e) => setKeepChecklists(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  Checklists
                  {checklistCount > 0 && (
                    <span className="ml-1 text-gray-400 dark:text-slate-500">
                      ({checklistCount})
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepMembers}
                  onChange={(e) => setKeepMembers(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  Members
                  {memberCount > 0 && (
                    <span className="ml-1 text-gray-400 dark:text-slate-500">({memberCount})</span>
                  )}
                </span>
              </label>
            </div>
          </div>

          {/* Copy to... section */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-2">
              Copy to...
            </p>
            <div className="space-y-2">
              {/* Board */}
              <div>
                <label htmlFor="copy-card-board" className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                  Board
                </label>
                <select
                  id="copy-card-board"
                  value={selectedBoardId}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* List + Position */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label htmlFor="copy-card-list" className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                    List
                  </label>
                  <select
                    id="copy-card-list"
                    value={selectedListId}
                    onChange={(e) => handleListChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-20 flex-shrink-0">
                  <label htmlFor="copy-card-position" className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                    Position
                  </label>
                  <select
                    id="copy-card-position"
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: maxPosition }, (_, i) => i + 1).map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedListId}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
            {submitting ? 'Creating...' : 'Create card'}
          </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CopyCardModal;
