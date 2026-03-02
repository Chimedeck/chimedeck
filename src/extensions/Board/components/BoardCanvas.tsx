// BoardCanvas — DndContext wrapper and horizontally scrollable kanban canvas.
// Handles card and list drag-and-drop with optimistic updates and rollback on failure.
import { useState, useCallback } from 'react';
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
import SortableListColumn from '../../List/containers/BoardPage/ListColumn';
import CardItem from '../../Card/components/CardItem';
import AddListForm from '../../List/components/AddListForm';

interface Props {
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
}

/** Find which list contains a given card ID */
function findListForCard(cardId: string, cardsByList: Record<string, string[]>): string | null {
  for (const [listId, ids] of Object.entries(cardsByList)) {
    if (ids.includes(cardId)) return listId;
  }
  return null;
}

const BoardCanvas = ({
  listOrder,
  lists,
  cardsByList,
  cards,
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
}: Props) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

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
      }
      onDragStart();
    },
    [cards, onDragStart],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // Only handle card-over-column or card-over-card
      if (!cards[activeId]) return; // dragging a list, not a card

      const fromListId = findListForCard(activeId, cardsByList);
      if (!fromListId) return;

      // Determine target list: either the over item is a list, or find its parent list
      let toListId = overId;
      if (!lists[overId]) {
        toListId = findListForCard(overId, cardsByList) ?? fromListId;
      }

      if (fromListId === toListId && activeId === overId) return;

      const toCards = cardsByList[toListId] ?? [];
      let newIndex = toCards.length;
      if (cards[overId] && toListId === findListForCard(overId, cardsByList)) {
        const idx = toCards.indexOf(overId);
        newIndex = idx >= 0 ? idx : toCards.length;
      }

      onCardMove({ cardId: activeId, fromListId, toListId, newIndex });
    },
    [cards, cardsByList, lists, onCardMove],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCardId(null);

      if (!over) {
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
        const toListId = findListForCard(activeId, cardsByList);
        const fromListId = findListForCard(activeId, cardsByList);
        if (!toListId || !fromListId) {
          onDragRollback();
          return;
        }
        const toCards = cardsByList[toListId] ?? [];
        const cardIndex = toCards.indexOf(activeId);
        const afterCardId = cardIndex > 0 ? (toCards[cardIndex - 1] ?? null) : null;
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
    [cards, cardsByList, lists, listOrder, onDragCommit, onDragRollback, onListReorder],
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
          className="flex gap-3 p-4 overflow-x-auto min-h-[calc(100vh-112px)]"
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
                cardIds={cardsByList[listId] ?? []}
                cards={cards}
                onRename={onRenameList}
                onArchive={onArchiveList}
                onDelete={onDeleteList}
                onAddCard={onAddCard}
                {...(onCardClick ? { onCardClick } : {})}
              />
            );
          })}
          {!isReadOnly && <AddListForm onSubmit={onAddList} />}
        </div>
      </SortableContext>

      {/* DragOverlay renders the dragged card at its drag position */}
      <DragOverlay>
        {activeCard && <CardItem card={activeCard} isOverlay />}
      </DragOverlay>
    </DndContext>
  );
};

export default BoardCanvas;
