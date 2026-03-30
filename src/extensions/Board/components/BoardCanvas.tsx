// BoardCanvas — DndContext wrapper and horizontally scrollable kanban canvas.
// Handles card and list drag-and-drop with optimistic updates and rollback on failure.
import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { List } from '../../List/api';
import type { Card } from '../../Card/api';
import type { CustomFieldValue } from '../../CustomFields/types';
import SortableListColumn from '../../List/containers/BoardPage/ListColumn';
import CardItem from '../../Card/components/CardItem';
import AddListForm from '../../List/components/AddListForm';
import { useCardLabelExpanded } from '../../Card/hooks/useCardLabelExpanded';

interface Props {
  boardId: string;
  boardTitle?: string;
  listOrder: string[];
  lists: Record<string, List>;
  cardsByList: Record<string, string[]>;
  cards: Record<string, Card>;
  onCardMove: (args: {
    cardId: string;
    fromListId: string;
    toListId: string;
    newIndex: number;
  }) => void;
  onListReorder: (newOrder: string[]) => void;
  onDragStart: () => void;
  onDragCommit: (args: {
    type: 'card' | 'list';
    cardId?: string;
    fromListId?: string;
    toListId?: string;
    afterCardId?: string | null;
    newListOrder?: string[];
  }) => Promise<void>;
  onDragRollback: () => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onAddList: (title: string) => Promise<void>;
  onRenameList: (listId: string, title: string) => void;
  onArchiveList: (listId: string) => void;
  onDeleteList: (listId: string) => void;
  onCardClick?: (cardId: string) => void;
  isReadOnly?: boolean;
  /** True when the current user is a GUEST with guestType=VIEWER — hides write-action controls. */
  isViewerGuest?: boolean;
  /** Pre-fetched custom field values for all cards on this board, keyed by cardId.
   *  null = batch not yet loaded (don't pass per-card values to tiles). */
  customFieldValuesMap?: Record<string, CustomFieldValue[]> | null;
  /** True when the board has a background image — columns render solid, headers get frosted-glass. */
  hasBackground?: boolean;
}

/** Find which list contains a given card ID */
function findListForCard(cardId: string, cardsByList: Record<string, string[]>): string | null {
  for (const [listId, ids] of Object.entries(cardsByList)) {
    if (ids.includes(cardId)) return listId;
  }
  return null;
}

const BoardCanvas = ({
  boardId,
  boardTitle,
  listOrder,
  lists,
  cardsByList,
  cards,
  hasBackground = false,
  onCardMove,
  onListReorder,
  onDragStart,
  onDragCommit,
  onDragRollback,
  onAddCard,
  onAddList,
  onRenameList,
  onArchiveList,
  onDeleteList,
  onCardClick,
  isReadOnly = false,
  isViewerGuest = false,
  customFieldValuesMap,
}: Props) => {
  const [labelsExpanded, onToggleLabels] = useCardLabelExpanded(boardId);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  // WHY: capture the source list at drag-start; by drag-end the optimistic move
  // has already updated cardsByList so re-deriving fromListId returns toListId.
  const fromListIdRef = useRef<string | null>(null);
  // WHY: track card ordering locally during drag instead of dispatching to Redux
  // on every onDragOver. Dispatching applyOptimisticCardMove each frame causes
  // DnD-kit to re-fire onDragOver after the re-render (with shifted indices),
  // creating an infinite update loop. Local state only affects BoardCanvas and
  // its children — no BoardPage/PluginIframeContainer re-renders during drag.
  const [dragCardsByList, setDragCardsByList] = useState<Record<string, string[]> | null>(null);
  const dragCardsByListRef = useRef<Record<string, string[]> | null>(null);
  dragCardsByListRef.current = dragCardsByList;
  const effectiveCardsByList = dragCardsByList ?? cardsByList;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      // Only set active card if the dragged item is a card (not a list)
      if (cards[id]) {
        setActiveCardId(id);
        fromListIdRef.current = findListForCard(id, cardsByList);
        // Snapshot current ordering into local drag state — onDragOver will
        // mutate this without touching Redux, preventing re-render loops.
        setDragCardsByList(cardsByList);
      }
      onDragStart();
    },
    [cards, cardsByList, onDragStart],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Only handle card-over-card or card-over-column (not list reorder)
      if (!cards[activeId]) return;

      // WHY: update local drag state only — no Redux dispatch here.
      // Dispatching onCardMove on every drag-over event triggers a Redux
      // re-render, which causes DnD-kit to re-fire onDragOver with shifted
      // indices → infinite update loop.
      setDragCardsByList((prev) => {
        if (!prev) return prev;
        const fromListId = findListForCard(activeId, prev);
        if (!fromListId) return prev;

        let toListId = overId;
        if (!lists[overId]) {
          toListId = findListForCard(overId, prev) ?? fromListId;
        }
        if (fromListId === toListId && activeId === overId) return prev;

        const toCards = prev[toListId] ?? [];
        let insertIndex = toCards.length;
        if (cards[overId]) {
          const idx = toCards.indexOf(overId);
          insertIndex = idx >= 0 ? idx : toCards.length;
        }

        if (fromListId === toListId) {
          const mutable = [...toCards];
          const fromIdx = mutable.indexOf(activeId);
          if (fromIdx === -1) return prev;
          mutable.splice(fromIdx, 1);
          mutable.splice(insertIndex > fromIdx ? insertIndex - 1 : insertIndex, 0, activeId);
          return { ...prev, [toListId]: mutable };
        }
        const newFrom = (prev[fromListId] ?? []).filter((id) => id !== activeId);
        const newTo = [...(prev[toListId] ?? [])];
        newTo.splice(insertIndex, 0, activeId);
        return { ...prev, [fromListId]: newFrom, [toListId]: newTo };
      });
    },
    [cards, lists],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCardId(null);

      if (!over) {
        setDragCardsByList(null);
        fromListIdRef.current = null;
        onDragRollback();
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      // List reorder
      if (lists[activeId]) {
        const oldIndex = listOrder.indexOf(activeId);
        const newIndex = listOrder.indexOf(overId);
        if (oldIndex !== newIndex && newIndex >= 0) {
          const newOrder = [...listOrder];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, activeId);
          onListReorder(newOrder);
          try {
            await onDragCommit({ type: 'list', newListOrder: newOrder });
          } catch {
            onDragRollback();
          }
        } else {
          onDragRollback();
        }
        return;
      }

      // Card move commit
      if (cards[activeId]) {
        // Read final position from local drag state before clearing it
        const finalCardsByList = dragCardsByListRef.current ?? cardsByList;
        const toListId = findListForCard(activeId, finalCardsByList);
        const fromListId = fromListIdRef.current ?? toListId;
        fromListIdRef.current = null;
        setDragCardsByList(null);
        if (!toListId || !fromListId) {
          onDragRollback();
          return;
        }
        const toCards = finalCardsByList[toListId] ?? [];
        const cardIndex = toCards.indexOf(activeId);
        const afterCardId = cardIndex > 0 ? (toCards[cardIndex - 1] ?? null) : null;
        const newIndex = cardIndex >= 0 ? cardIndex : toCards.length;
        // Apply the final position to Redux in a single dispatch (moved here
        // from onDragOver — see handleDragOver comment for why)
        onCardMove({ cardId: activeId, fromListId, toListId, newIndex });
        try {
          await onDragCommit({
            type: 'card',
            cardId: activeId,
            fromListId,
            toListId,
            afterCardId,
          });
        } catch {
          onDragRollback();
        }
      }
    },
    [cards, cardsByList, lists, listOrder, onCardMove, onDragCommit, onDragRollback, onListReorder],
  );

  const activeCard = activeCardId ? cards[activeCardId] : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={listOrder} strategy={horizontalListSortingStrategy}>
        <div
          className="flex gap-3 p-4 overflow-x-auto overflow-y-hidden flex-1"
          role="list"
          aria-label="Board lists"
        >
          {listOrder.map((listId) => {
            const list = lists[listId];
            if (!list) return null;
            return (
              <SortableListColumn
                key={listId}
                list={list}
                cardIds={effectiveCardsByList[listId] ?? []}
                cards={cards}
                boardId={boardId}
                {...(boardTitle ? { boardTitle } : {})}
                onRename={onRenameList}
                onArchive={onArchiveList}
                onDelete={onDeleteList}
                onAddCard={onAddCard}
                labelsExpanded={labelsExpanded}
                onToggleLabels={onToggleLabels}
                {...(onCardClick ? { onCardClick } : {})}
                {...(customFieldValuesMap ? { customFieldValuesMap } : {})}
                isViewerGuest={isViewerGuest}
                hasBackground={hasBackground}
              />
            );
          })}
          {!isReadOnly && <AddListForm onSubmit={onAddList} />}
        </div>
      </SortableContext>

      {/* DragOverlay renders the dragged card at its drag position */}
      <DragOverlay>
        {activeCard && (
          <CardItem
            card={activeCard}
            isOverlay
            listTitle={lists[activeCard.list_id]?.title}
            boardTitle={boardTitle}
            labelsExpanded={labelsExpanded}
            onToggleLabels={onToggleLabels}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default BoardCanvas;
