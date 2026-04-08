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

interface DragPlaceholder {
  listId: string;
  index: number;
  height: number;
}

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

function buildCardToListMap(cardsByList: Record<string, string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [listId, ids] of Object.entries(cardsByList)) {
    for (const id of ids) out[id] = listId;
  }
  return out;
}

function getPointerClientY(evt: Event | null | undefined): number | null {
  if (!evt) return null;
  if ('clientY' in evt && typeof evt.clientY === 'number') {
    return evt.clientY;
  }
  if ('changedTouches' in evt) {
    const touch = (evt as TouchEvent).changedTouches?.item(0);
    return touch ? touch.clientY : null;
  }
  return null;
}

function normalizePlaceholderHeight(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 24) {
    return 72;
  }
  return value;
}

function getSortableContainerId(
  over: DragOverEvent['over'] | DragEndEvent['over'] | null | undefined,
): string | null {
  const data = over?.data?.current as { sortable?: { containerId?: unknown } } | undefined;
  const containerId = data?.sortable?.containerId;
  return typeof containerId === 'string' ? containerId : null;
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
  const totalCards = Object.keys(cards).length;
  // WHY: live reordering during drag-over updates React state on nearly every
  // pointer move. On very large boards this causes visible jank, so we switch
  // to drop-time commit only for smoother dragging.
  const disableLiveDragPreview = totalCards >= 120;
  const [labelsExpanded, onToggleLabels] = useCardLabelExpanded(boardId);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [dragPlaceholder, setDragPlaceholder] = useState<DragPlaceholder | null>(null);
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
  const dragCardToListRef = useRef<Record<string, string> | null>(null);
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
        const startListId = findListForCard(id, cardsByList);
        if (disableLiveDragPreview && startListId) {
          const startIndex = Math.max(0, (cardsByList[startListId] ?? []).indexOf(id));
          const startHeight = normalizePlaceholderHeight(event.active.rect.current.initial?.height);
          setDragPlaceholder({ listId: startListId, index: startIndex, height: startHeight });
        }
        if (disableLiveDragPreview) {
          dragCardsByListRef.current = null;
          dragCardToListRef.current = null;
          setDragCardsByList(null);
        } else {
          // Snapshot current ordering into local drag state — onDragOver will
          // mutate this without touching Redux, preventing re-render loops.
          dragCardsByListRef.current = cardsByList;
          dragCardToListRef.current = buildCardToListMap(cardsByList);
          setDragCardsByList(cardsByList);
        }
      }
    },
    [cards, cardsByList, disableLiveDragPreview],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      const pointerY = getPointerClientY((event as { activatorEvent?: Event }).activatorEvent);

      const activeId = String(active.id);
      const overId = String(over.id);

      // Only handle card-over-card or card-over-column (not list reorder)
      if (!cards[activeId]) return;
      if (disableLiveDragPreview) {
        const sourceListId = fromListIdRef.current ?? findListForCard(activeId, cardsByList);
        if (!sourceListId) return;

        const overContainerId = getSortableContainerId(over);
        let toListId = overContainerId ?? overId;
        if (!lists[toListId]) {
          toListId = findListForCard(overId, cardsByList) ?? sourceListId;
        }

        const targetCards = (cardsByList[toListId] ?? []).filter((id) => id !== activeId);
        let insertIndex = targetCards.length;
        const placeholderHeight = normalizePlaceholderHeight(
          active.rect.current.initial?.height
          ?? active.rect.current.translated?.height
          ?? 72,
        );

        if (cards[overId]) {
          const overIndex = targetCards.indexOf(overId);
          if (overIndex >= 0) {
            const translatedRect = active.rect.current.translated;
            const translatedCenterY = translatedRect
              ? translatedRect.top + translatedRect.height / 2
              : null;
            // WHY: prefer translatedCenterY (current drag position) over
            // pointerY (activatorEvent Y = drag-start position, not current).
            const effectiveY = translatedCenterY ?? pointerY;
            const isBelowOverCard =
              effectiveY != null &&
              effectiveY > over.rect.top + over.rect.height / 2;
            insertIndex = overIndex + (isBelowOverCard ? 1 : 0);
          }
        }

        setDragPlaceholder((prev) => {
          if (
            prev?.listId === toListId
            && prev.index === insertIndex
            && Math.abs(prev.height - placeholderHeight) < 1
          ) {
            return prev;
          }
          return { listId: toListId, index: insertIndex, height: placeholderHeight };
        });
        return;
      }

      // WHY: update local drag state only — no Redux dispatch here.
      // Dispatching onCardMove on every drag-over event triggers a Redux
      // re-render, which causes DnD-kit to re-fire onDragOver with shifted
      // indices → infinite update loop.
      setDragCardsByList((prev) => {
        if (!prev) return prev;
        const cardToList = dragCardToListRef.current ?? buildCardToListMap(prev);
        dragCardToListRef.current = cardToList;
        const fromListId = cardToList[activeId] ?? findListForCard(activeId, prev);
        if (!fromListId) return prev;

        let toListId = overId;
        if (!lists[overId]) {
          toListId = cardToList[overId] ?? findListForCard(overId, prev) ?? fromListId;
        }
        if (fromListId === toListId && activeId === overId) return prev;

        const toCards = prev[toListId] ?? [];
        let insertIndex = toCards.length;
        if (cards[overId]) {
          const idx = toCards.indexOf(overId);
          const fromIdxInTarget = toCards.indexOf(activeId);
          if (fromListId === toListId && fromIdxInTarget !== -1 && idx !== -1) {
            // Deterministic same-list behavior: dropping on a card moves above
            // when dragging upward and below when dragging downward.
            insertIndex = idx + (fromIdxInTarget < idx ? 1 : 0);
          } else {
          // Use pointer position to decide before/after when hovering a card.
          // Without this, dragging card 1 onto card 2 always inserts before 2,
          // so adjacent swaps require touching card 3.
          const translatedRect = active.rect.current.translated;
          const translatedCenterY = translatedRect
            ? translatedRect.top + translatedRect.height / 2
            : null;
          // WHY: prefer translatedCenterY (current drag position) over
          // pointerY (activatorEvent Y = drag-start position, not current).
          const effectiveY = translatedCenterY ?? pointerY;
          const isBelowOverCard =
            effectiveY != null &&
            effectiveY > over.rect.top + over.rect.height / 2;
          if (idx >= 0) {
            insertIndex = idx + (isBelowOverCard ? 1 : 0);
          } else {
            insertIndex = toCards.length;
          }
          }
        }

        if (fromListId === toListId) {
          const mutable = [...toCards];
          const fromIdx = mutable.indexOf(activeId);
          if (fromIdx === -1) return prev;
          mutable.splice(fromIdx, 1);
          const adjustedIndex = insertIndex > fromIdx ? insertIndex - 1 : insertIndex;
          mutable.splice(adjustedIndex, 0, activeId);
          const next = { ...prev, [toListId]: mutable };
          // Keep ref in sync immediately so handleDragEnd can commit the
          // latest order even if React state batching hasn't painted yet.
          dragCardsByListRef.current = next;
          return next;
        }
        const newFrom = (prev[fromListId] ?? []).filter((id) => id !== activeId);
        const newTo = [...(prev[toListId] ?? [])];
        newTo.splice(insertIndex, 0, activeId);
        const next = { ...prev, [fromListId]: newFrom, [toListId]: newTo };
        cardToList[activeId] = toListId;
        // Keep ref in sync immediately so handleDragEnd can commit the
        // latest order even if React state batching hasn't painted yet.
        dragCardsByListRef.current = next;
        return next;
      });
    },
    [cards, disableLiveDragPreview, lists],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const pointerY = getPointerClientY((event as { activatorEvent?: Event }).activatorEvent);
      setActiveCardId(null);

      if (!over) {
        setDragCardsByList(null);
        setDragPlaceholder(null);
        fromListIdRef.current = null;
        dragCardToListRef.current = null;
        onDragRollback();
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      // List reorder
      if (lists[activeId]) {
        setDragPlaceholder(null);
        dragCardToListRef.current = null;
        const oldIndex = listOrder.indexOf(activeId);
        const newIndex = listOrder.indexOf(overId);
        if (oldIndex !== newIndex && newIndex >= 0) {
          const newOrder = [...listOrder];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, activeId);
          onDragStart();
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
        setDragPlaceholder(null);
        // Read final position from local drag state before clearing it
        const finalCardsByList = dragCardsByListRef.current ?? cardsByList;
        const dragCardToList = dragCardToListRef.current;
        const toListId = dragCardToList?.[activeId] ?? findListForCard(activeId, finalCardsByList);
        const fromListId = fromListIdRef.current ?? toListId;
        fromListIdRef.current = null;
        dragCardsByListRef.current = null;
        dragCardToListRef.current = null;
        setDragCardsByList(null);
        if (!toListId || !fromListId) {
          onDragRollback();
          return;
        }

        let resolvedToListId = toListId;
        let resolvedNewIndex = (finalCardsByList[toListId] ?? []).indexOf(activeId);
        const overContainerId = getSortableContainerId(over);
        if (resolvedNewIndex < 0) {
          resolvedNewIndex = (finalCardsByList[toListId] ?? []).length;
        }

        if (disableLiveDragPreview && dragPlaceholder) {
          const placeholderListId = dragPlaceholder.listId;
          const targetWithoutActive = (finalCardsByList[placeholderListId] ?? []).filter((id) => id !== activeId);
          resolvedToListId = placeholderListId;
          resolvedNewIndex = Math.max(0, Math.min(dragPlaceholder.index, targetWithoutActive.length));
        }

        // WHY: these fallback blocks recalculate position from overId and are only
        // needed when disableLiveDragPreview=true and the placeholder was not set
        // (edge case). For live-preview mode (disableLiveDragPreview=false),
        // finalCardsByList already contains the correct order from handleDragOver,
        // so re-entering here would double-count the move and produce the wrong index
        // (e.g. same-list drag from 0→1 would set resolvedNewIndex back to 0).
        if (disableLiveDragPreview && !dragPlaceholder && cards[overId]) {
          const hoverListId = dragCardToList?.[overId] ?? findListForCard(overId, finalCardsByList) ?? resolvedToListId;
          const sourceCardsInHoverList = finalCardsByList[hoverListId] ?? [];
          const fromIdxInHover = sourceCardsInHoverList.indexOf(activeId);
          const overIdxInHover = sourceCardsInHoverList.indexOf(overId);
          const targetCards = [...(finalCardsByList[hoverListId] ?? [])].filter((id) => id !== activeId);
          const hoverIndex = targetCards.indexOf(overId);
          if (hoverIndex >= 0) {
            resolvedToListId = hoverListId;
            if (fromListId === hoverListId && fromIdxInHover !== -1 && overIdxInHover !== -1) {
              resolvedNewIndex = hoverIndex + (fromIdxInHover < overIdxInHover ? 1 : 0);
            } else {
              const translatedRect = active.rect.current.translated;
              const translatedCenterY = translatedRect
                ? translatedRect.top + translatedRect.height / 2
                : null;
              // WHY: prefer translatedCenterY (current drag position) over
              // pointerY (activatorEvent Y = drag-start position, not current).
              const effectiveY = translatedCenterY ?? pointerY ?? over.rect.top;
              const isBelowHoverCard = effectiveY > over.rect.top + over.rect.height / 2;
              resolvedNewIndex = hoverIndex + (isBelowHoverCard ? 1 : 0);
            }
          }
        } else if (disableLiveDragPreview && !dragPlaceholder && lists[overId]) {
          resolvedToListId = overId;
          resolvedNewIndex = (finalCardsByList[overId] ?? []).length;
        } else if (disableLiveDragPreview && !dragPlaceholder && overContainerId && lists[overContainerId]) {
          resolvedToListId = overContainerId;
          resolvedNewIndex = (finalCardsByList[overContainerId] ?? []).length;
        }

        const targetPreview = [...(finalCardsByList[resolvedToListId] ?? [])].filter((id) => id !== activeId);
        targetPreview.splice(resolvedNewIndex, 0, activeId);
        const afterCardId = resolvedNewIndex > 0 ? (targetPreview[resolvedNewIndex - 1] ?? null) : null;

        // Apply the final position to Redux in a single dispatch (moved here
        // from onDragOver — see handleDragOver comment for why)
        onDragStart();
        onCardMove({
          cardId: activeId,
          fromListId,
          toListId: resolvedToListId,
          newIndex: resolvedNewIndex,
        });
        try {
          await onDragCommit({
            type: 'card',
            cardId: activeId,
            fromListId,
            toListId: resolvedToListId,
            afterCardId,
          });
        } catch {
          onDragRollback();
        }
      }
    },
    [cards, cardsByList, disableLiveDragPreview, dragPlaceholder, lists, listOrder, onCardMove, onDragCommit, onDragRollback, onListReorder],
  );

  const activeCard = activeCardId ? cards[activeCardId] : null;
  const overlayProps: { listTitle?: string; boardTitle?: string } = {};
  if (activeCard) {
    const overlayListTitle = lists[activeCard.list_id]?.title;
    if (typeof overlayListTitle === 'string') {
      overlayProps.listTitle = overlayListTitle;
    }
    if (typeof boardTitle === 'string') {
      overlayProps.boardTitle = boardTitle;
    }
  }

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
                {...(dragPlaceholder?.listId === listId ? { dragPlaceholderIndex: dragPlaceholder.index } : {})}
                {...(dragPlaceholder?.listId === listId ? { dragPlaceholderHeight: dragPlaceholder.height } : {})}
              />
            );
          })}
          {!isReadOnly && <AddListForm onSubmit={onAddList} />}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeCard && (
          <CardItem
            card={activeCard}
            isOverlay
            {...overlayProps}
            labelsExpanded={labelsExpanded}
            onToggleLabels={onToggleLabels}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default BoardCanvas;
