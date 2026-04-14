// MoveCardModal — dialog to move a card to any board/list/position the caller can write to.
// [why] Uses a nested Radix Dialog so that Radix's FocusScope stack properly hands off focus
// from the card modal to this dialog and back — a plain portal div would steal focus from
// the outer FocusScope.
import { useEffect, useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import type { Board } from '../../Board/api';
import type { List } from '../../List/api';
import type { Card } from '../api';

interface CardRow {
  id: string;
  list_id: string;
  archived: boolean;
}

interface Props {
  cardId: string;
  currentBoardId: string;
  currentListId: string;
  workspaceId: string;
  api: {
    get: <T>(url: string) => Promise<T>;
    patch: <T>(url: string, data: unknown) => Promise<T>;
  };
  onClose: () => void;
  onSuccess: (card: Card) => void;
}

type BoardWithCards = { data: Board; includes: { cards: CardRow[] } };

const MoveCardModal = ({
  cardId,
  currentBoardId,
  currentListId,
  workspaceId,
  api,
  onClose,
  onSuccess,
}: Props) => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState(currentBoardId);

  const [lists, setLists] = useState<List[]>([]);
  const [selectedListId, setSelectedListId] = useState(currentListId);

  // cards in the selected list (excluding the card being moved)
  const [listCards, setListCards] = useState<CardRow[]>([]);
  const [selectedPosition, setSelectedPosition] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available boards once on mount
  useEffect(() => {
    api
      .get<{ data: Board[] }>(`/workspaces/${workspaceId}/boards`)
      .then(({ data }) => {
        const active = data.filter((b) => b.state === 'ACTIVE' || !('state' in b));
        setBoards(active);
      })
      .catch(() => {});
  }, [api, workspaceId]);

  // Fetch lists and cards when board selection changes
  const fetchBoardData = useCallback(
    async (boardId: string) => {
      try {
        const [listsRes, boardRes] = await Promise.all([
          api.get<{ data: List[] }>(`/boards/${boardId}/lists`),
          api.get<BoardWithCards>(`/boards/${boardId}`),
        ]);

        const nonArchivedLists = listsRes.data.filter((l) => !l.archived);
        setLists(nonArchivedLists);

        const allCards: CardRow[] = boardRes.includes.cards;

        // Default to current list when staying on the same board, else first list
        const defaultList =
          boardId === currentBoardId
            ? nonArchivedLists.find((l) => l.id === currentListId) ?? nonArchivedLists[0]
            : nonArchivedLists[0];

        if (defaultList) {
          setSelectedListId(defaultList.id);
          const cards = allCards.filter((c) => c.list_id === defaultList.id && !c.archived && c.id !== cardId);
          setListCards(cards);
          // Default to bottom (after all existing cards)
          setSelectedPosition(cards.length + 1);
        }
      } catch {
        setLists([]);
        setListCards([]);
      }
    },
    [api, cardId, currentBoardId, currentListId],
  );

  useEffect(() => {
    void fetchBoardData(selectedBoardId);
  }, [selectedBoardId, fetchBoardData]);

  // Refresh cards in the selected list when list changes.
  const handleListChange = useCallback(
    async (listId: string) => {
      setSelectedListId(listId);
      try {
        const boardRes = await api.get<BoardWithCards>(
          `/boards/${selectedBoardId}`,
        );
        const allCards: CardRow[] = boardRes.includes.cards;
        const cards = allCards.filter((c) => c.list_id === listId && !c.archived && c.id !== cardId);
        setListCards(cards);
        setSelectedPosition(cards.length + 1);
      } catch {
        setListCards([]);
        setSelectedPosition(1);
      }
    },
    [api, cardId, selectedBoardId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId) return;
    setSubmitting(true);
    setError(null);
    try {
      // Translate numeric position to afterCardId:
      //   position 1  → afterCardId: null  (prepend before first card)
      //   position k  → afterCardId: listCards[k-2].id
      const afterCardId =
        selectedPosition <= 1 ? null : (listCards[selectedPosition - 2]?.id ?? null);

      const result = await api.patch<{ data: Card }>(`/cards/${cardId}/move`, { targetListId: selectedListId, afterCardId });
      onSuccess(result.data);
    } catch {
      setError('Failed to move card. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const maxPosition = listCards.length + 1;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50" />
        <Dialog.Content
          className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          onInteractOutside={(e) => { e.preventDefault(); onClose(); }}
          onEscapeKeyDown={onClose}
          aria-label="Move card"
        >
          <Dialog.Title className="sr-only">Move card</Dialog.Title>
          <div className="relative w-80 rounded-2xl bg-bg-surface shadow-2xl overflow-hidden pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-base">Move card</h2>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted hover:bg-bg-overlay"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-4 h-4" />
                </Button>
              </Dialog.Close>
            </div>

            <form onSubmit={(e) => { void handleSubmit(e); }} className="p-4 space-y-4">
              {/* Select destination */}
              <div>
                <p className="text-xs font-medium text-muted mb-2">Select destination</p>
                <div className="space-y-2">
                  {/* Board */}
                  <div>
                    <label htmlFor="move-card-board" className="block text-xs font-medium text-muted mb-1">
                      Board
                    </label>
                    <select
                      id="move-card-board"
                      value={selectedBoardId}
                      onChange={(e) => { setSelectedBoardId(e.target.value); }}
                      className="w-full rounded-lg border border-border bg-bg-overlay px-2 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
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
                      <label htmlFor="move-card-list" className="block text-xs font-medium text-muted mb-1">
                        List
                      </label>
                      <select
                        id="move-card-list"
                        value={selectedListId}
                        onChange={(e) => { void handleListChange(e.target.value); }}
                        className="w-full rounded-lg border border-border bg-bg-overlay px-2 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-20 flex-shrink-0">
                      <label htmlFor="move-card-position" className="block text-xs font-medium text-muted mb-1">
                        Position
                      </label>
                      <select
                        id="move-card-position"
                        value={selectedPosition}
                        onChange={(e) => { setSelectedPosition(Number(e.target.value)); }}
                        className="w-full rounded-lg border border-border bg-bg-overlay px-2 py-1.5 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
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

              {error && <p className="text-xs text-danger">{error}</p>}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                disabled={submitting || !selectedListId}
              >
                <ArrowRightIcon className="w-4 h-4 mr-1" />
                {submitting ? 'Moving…' : 'Move'}
              </Button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default MoveCardModal;
