// BoardCanvas — DndContext wrapper and horizontally scrollable kanban canvas.
// Handles card and list drag-and-drop with optimistic updates and rollback on failure.
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
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

/**
 * Derive the **current** pointer clientY for a DragOverEvent or DragEndEvent.
 *
 * @dnd-kit stores the drag-activation event in `activatorEvent` (fixed for the
 * entire drag lifetime). The current pointer Y is recovered by adding the
 * vertical translation delta to the initial pointer Y:
 *
 *   currentPointerY = activatorPointerY + (translated.top - initial.top)
 *
 * Falls back to the centre of the translated rect when initial data is absent
 * (e.g. keyboard sensor which has no clientY).
 */
function getCurrentPointerY(
  activatorEvent: Event | null | undefined,
  initial: { top: number; height: number } | null | undefined,
  translated: { top: number; height: number } | null | undefined,
): number | null {
  const activatorY = getPointerClientY(activatorEvent);
  if (activatorY != null && initial != null && translated != null) {
    return activatorY + (translated.top - initial.top);
  }
  // Keyboard sensor / missing data: use translated element centre as proxy
  if (translated != null) {
    return translated.top + translated.height / 2;
  }
  return activatorY ?? null;
}

/**
 * Get the viewport midpoint Y of a droppable element by its DnD id.
 * DnD Kit's `over.rect` uses an internal coordinate system that can differ
 * from viewport coordinates. Querying the DOM directly via getBoundingClientRect
 * gives the true viewport midpoint for accurate pointer-vs-card comparisons.
 */
function getOverCardViewportMidY(overId: string): number | null {
  const el = document.querySelector(`[aria-label^="Card:"][data-dnd-card-id="${overId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return (r.top + r.bottom) / 2;
}

function getInsertIndexFromPointerY(cardIds: string[], pointerY: number | null): number {
  if (pointerY == null || cardIds.length === 0) return cardIds.length;
  let insertIndex = 0;
  for (let i = 0; i < cardIds.length; i += 1) {
    const cardId = cardIds[i];
    const mid = cardId == null ? null : getOverCardViewportMidY(cardId);
    if (mid == null) continue;
    if (pointerY >= mid - DRAG_MIDPOINT_TOLERANCE_PX) {
      insertIndex = i + 1;
      continue;
    }
    break;
  }
  return insertIndex;
}

function normalizePlaceholderHeight(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 24) {
    return 72;
  }
  return value;
}

// WHY: DOM/mouse coordinates during drag frequently include sub-pixel values.
// A tiny tolerance makes midpoint crossing deterministic when the pointer is
// visually at the middle but differs by a fraction in floating-point math.
const DRAG_MIDPOINT_TOLERANCE_PX = 1;

function getSortableContainerId(
  over: DragOverEvent['over'] | DragEndEvent['over'] | null | undefined,
): string | null {
  const data = over?.data?.current as { sortable?: { containerId?: unknown } } | undefined;
  const containerId = data?.sortable?.containerId;
  return typeof containerId === 'string' ? containerId : null;
}

function getBoardListIdFromElement(element: Element | null): string | null {
  const listEl = element?.closest('[id^="board-list-"]');
  if (!listEl || !(listEl instanceof HTMLElement) || !listEl.id.startsWith('board-list-')) {
    return null;
  }
  return listEl.id.slice('board-list-'.length);
}

function getBoardListIdFromPointer(clientX: number | null, clientY: number | null): string | null {
  if (clientX == null || clientY == null) return null;

  const hitElement = document.elementFromPoint(clientX, clientY);
  const hitListId = getBoardListIdFromElement(hitElement);
  if (hitListId) return hitListId;

  // WHY: on empty columns or near edges, elementFromPoint can briefly resolve
  // to non-list layers. Fall back to list rectangles to keep cross-column drag
  // targeting stable.
  const listElements = Array.from(document.querySelectorAll<HTMLElement>('[id^="board-list-"]'));
  const containingRect = listElements.find((el) => {
    const r = el.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  });
  if (containingRect) {
    return containingRect.id.slice('board-list-'.length);
  }

  // WHY: if Y exits the list rect while dragging fast, keep destination by
  // selecting the nearest list horizontally.
  let nearestListId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  listElements.forEach((el) => {
    const r = el.getBoundingClientRect();
    const centerX = (r.left + r.right) / 2;
    const distance = Math.abs(clientX - centerX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestListId = el.id.slice('board-list-'.length);
    }
  });
  return nearestListId;
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
  // WHY: mirror dragPlaceholder in a ref so handleDragEnd always reads the
  // latest value even when React hasn't flushed the last setDragPlaceholder
  // update before pointerup fires (same pattern as dragCardsByListRef).
  const dragPlaceholderRef = useRef<DragPlaceholder | null>(null);
  // WHY: capture the source list at drag-start; by drag-end the optimistic move
  // has already updated cardsByList so re-deriving fromListId returns toListId.
  const fromListIdRef = useRef<string | null>(null);
  // WHY: track the live pointer Y via a global pointermove listener so we have
  // true viewport coordinates in handleDragOver/handleDragEnd. DnD Kit's
  // activatorEvent.clientY is fixed at drag-activation time, and
  // active.rect.current.translated uses an internal coordinate system that can
  // differ from viewport coordinates (e.g. due to DnD Kit scroll adjustments).
  const livePointerYRef = useRef<number | null>(null);
  const livePointerXRef = useRef<number | null>(null);
  // WHY: snapshot each card's viewport midpoint at drag-start (before DnD Kit
  // applies sorting transforms) so the pointermove handler can compare the live
  // pointer Y against STABLE positions rather than the transformed ones.
  const dragStartCardMidsRef = useRef<Record<string, number>>({});
  // WHY: track which card is being dragged so the pointermove handler can skip
  // same-list placeholder updates when no drag is in progress.
  const dragActiveIdRef = useRef<string | null>(null);
  // WHY: keep a ref copy of cardsByList so the pointermove handler (no deps) can
  // read the latest list composition without a stale closure.
  const cardsByListRef = useRef(cardsByList);
  useEffect(() => { cardsByListRef.current = cardsByList; }, [cardsByList]);
  // WHY: keep a ref copy of disableLiveDragPreview so the pointermove handler
  // (empty deps array) does not close over a stale value.
  const disableLiveDragPreviewRef = useRef(disableLiveDragPreview);
  useEffect(() => { disableLiveDragPreviewRef.current = disableLiveDragPreview; }, [disableLiveDragPreview]);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      livePointerXRef.current = e.clientX;
      livePointerYRef.current = e.clientY;

      // WHY: update the drag placeholder index on every pointermove rather than
      // only on DnD Kit's onDragOver (which fires once per over.id change).
      // Within a single card's hitbox, onDragOver never re-fires, so the
      // pointer can cross the card's midpoint without triggering an update.
      // Using stable pre-drag snapshots avoids the DnD Kit transform offset.
      const activeId = dragActiveIdRef.current;
      const fromListId = fromListIdRef.current;
      if (!activeId || !fromListId || !disableLiveDragPreviewRef.current) return;

      // WHY: when the pointer is over another list, cross-list placeholder is
      // resolved by handleDragOver. Skipping same-list midpoint logic here
      // prevents it from immediately overriding that destination placeholder.
      const pointerListId = getBoardListIdFromPointer(e.clientX, e.clientY);
      const placeholderListId = dragPlaceholderRef.current?.listId ?? null;
      if (pointerListId && pointerListId !== fromListId) return;
      // WHY: when moving across columns, elementFromPoint can briefly return
      // null (gaps/edges/overlay transitions). If we immediately fall back to
      // same-list midpoint logic, the indicator snaps back to the source list
      // even though the cursor is still over another column. Keep the existing
      // cross-list placeholder until the pointer is positively in source again.
      if (!pointerListId && placeholderListId && placeholderListId !== fromListId) return;

      const targetCards = (cardsByListRef.current[fromListId] ?? []).filter(
        (id) => id !== activeId,
      );
      const mids = dragStartCardMidsRef.current;
      let insertIndex = 0;
      for (let i = 0; i < targetCards.length; i++) {
        const cardId = targetCards[i];
        const mid = cardId == null ? undefined : mids[cardId];
        if (mid != null && e.clientY >= mid - DRAG_MIDPOINT_TOLERANCE_PX) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }

      // WHY: update the ref SYNCHRONOUSLY before calling setDragPlaceholder so
      // that handleDragEnd always reads the latest placeholder index even when
      // it fires before React has processed the pending state update. React's
      // state-updater functions run during render (async), not at call time.
      const prevPlaceholder = dragPlaceholderRef.current;
      if (prevPlaceholder?.listId !== fromListId || prevPlaceholder.index !== insertIndex) {
        const height = prevPlaceholder?.height ?? 72;
        const next = { listId: fromListId, index: insertIndex, height };
        dragPlaceholderRef.current = next;
        setDragPlaceholder(next);
      }
    };
    globalThis.addEventListener('pointermove', handler, { passive: true });
    return () => globalThis.removeEventListener('pointermove', handler);
  }, []);
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

  // WHY: on dense boards the default collision detection can keep resolving
  // card drags to the source list even when the pointer is clearly over a
  // different column. Prefer pointer-based collisions for cards so cross-list
  // drops resolve to the destination under the cursor.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const activeId = String(args.active.id);
      if (!cards[activeId]) {
        return rectIntersection(args);
      }
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        return pointerCollisions;
      }
      return rectIntersection(args);
    },
    [cards],
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
          const startPlaceholder = { listId: startListId, index: startIndex, height: startHeight };
          dragPlaceholderRef.current = startPlaceholder;
          setDragPlaceholder(startPlaceholder);

          // WHY: snapshot card viewport midpoints BEFORE DnD Kit applies sorting
          // transforms so the pointermove handler can compare the live pointer Y
          // against stable positions. Must run after setDragPlaceholder so the
          // rendered DOM still shows the original layout.
          const mids: Record<string, number> = {};
          (cardsByList[startListId] ?? []).forEach((cardId) => {
            if (cardId === id) return;
            const el = document.querySelector(`[data-dnd-card-id="${cardId}"]`);
            if (el) {
              const r = el.getBoundingClientRect();
              mids[cardId] = (r.top + r.bottom) / 2;
            }
          });
          dragStartCardMidsRef.current = mids;
          dragActiveIdRef.current = id;
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
      // WHY: use the globally tracked live pointer Y (viewport coordinates).
      // DnD Kit's activatorEvent.clientY is fixed at drag-activation time and
      // active.rect translation deltas are in an internal coordinate system that
      // does NOT map 1:1 to viewport pixels. The pointermove listener gives us
      // the true viewport Y at any point during the drag.
      const pointerY = livePointerYRef.current;
      const pointerX = livePointerXRef.current;

      const activeId = String(active.id);

      // Only handle card-over-card or card-over-column (not list reorder)
      if (!cards[activeId]) return;
      if (disableLiveDragPreview) {
        const sourceListId = fromListIdRef.current ?? findListForCard(activeId, cardsByList);
        if (!sourceListId) return;

        const pointerListId = getBoardListIdFromPointer(pointerX, pointerY);

        if (!over) {
          if (!pointerListId || !lists[pointerListId] || pointerListId === sourceListId) return;
          const targetCards = (cardsByList[pointerListId] ?? []).filter((id) => id !== activeId);
          const insertIndex = getInsertIndexFromPointerY(targetCards, pointerY);
          const placeholderHeight = normalizePlaceholderHeight(
            active.rect.current.initial?.height
            ?? active.rect.current.translated?.height
            ?? 72,
          );
          setDragPlaceholder((prev) => {
            if (
              prev?.listId === pointerListId
              && prev.index === insertIndex
              && Math.abs(prev.height - placeholderHeight) < 1
            ) {
              return prev;
            }
            const next = { listId: pointerListId, index: insertIndex, height: placeholderHeight };
            dragPlaceholderRef.current = next;
            return next;
          });
          return;
        }

        const overId = String(over.id);

        const overContainerId = getSortableContainerId(over);
        let toListId = overContainerId ?? overId;
        if (pointerListId && lists[pointerListId]) {
          toListId = pointerListId;
        }
        if (!lists[toListId]) {
          toListId = findListForCard(overId, cardsByList) ?? sourceListId;
        }

        // WHY: same-list position is handled in real-time by the pointermove
        // handler (using pre-drag card midpoint snapshots). Only handle
        // cross-list transitions here, where DnD Kit's over.id change is the
        // most reliable signal and the target list has no DnD Kit transforms.
        if (toListId === sourceListId) return;

        const targetCards = (cardsByList[toListId] ?? []).filter((id) => id !== activeId);
        let insertIndex = getInsertIndexFromPointerY(targetCards, pointerY);
        const placeholderHeight = normalizePlaceholderHeight(
          active.rect.current.initial?.height
          ?? active.rect.current.translated?.height
          ?? 72,
        );

        if (cards[overId]) {
          const overIndex = targetCards.indexOf(overId);
          if (overIndex >= 0) {
            // WHY: for cross-list moves, the target list's cards have no DnD Kit
            // sorting transforms, so getOverCardViewportMidY returns accurate
            // viewport positions.
            const overViewportMid = getOverCardViewportMidY(overId);
            const isBelowOverCard =
              pointerY != null && overViewportMid != null
                ? pointerY >= overViewportMid - DRAG_MIDPOINT_TOLERANCE_PX
                : false;
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
          const next = { listId: toListId, index: insertIndex, height: placeholderHeight };
          // WHY: update ref synchronously so handleDragEnd reads the latest
          // value even if React hasn't re-rendered since this update.
          dragPlaceholderRef.current = next;
          return next;
        });
        return;
      }

      if (!over) return;

      const overId = String(over.id);

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
            if (idx >= 0) {
              // WHY: always compare pointer position to the hovered card's midpoint.
              // The previous direction-based heuristic (`fromIdxInTarget < idx`)
              // used the card's current index in the live-preview list, which
              // caused oscillation: after the preview moved A to position 1,
              // hovering over B again would see A "above" B and snap it back to 0,
              // even though the pointer hadn't moved above B's midpoint.
              const overViewportMid = getOverCardViewportMidY(overId);
              const isBelowOverCard =
                pointerY != null && overViewportMid != null
                  ? pointerY >= overViewportMid - DRAG_MIDPOINT_TOLERANCE_PX
                  : false;
              insertIndex = idx + (isBelowOverCard ? 1 : 0);
            } else {
              insertIndex = toCards.length;
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
      setActiveCardId(null);
      // WHY: clear dragActiveIdRef so the pointermove handler stops updating
      // the placeholder after the drag is committed.
      dragActiveIdRef.current = null;
      dragStartCardMidsRef.current = {};

      if (!over) {
        setDragCardsByList(null);
        dragPlaceholderRef.current = null;
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
        dragPlaceholderRef.current = null;
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
        // Read final placeholder from ref (not state) to avoid stale closure.
        const latestPlaceholder = dragPlaceholderRef.current;
        dragPlaceholderRef.current = null;
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

        if (disableLiveDragPreview && latestPlaceholder) {
          const placeholderListId = latestPlaceholder.listId;
          const targetWithoutActive = (finalCardsByList[placeholderListId] ?? []).filter((id) => id !== activeId);
          resolvedToListId = placeholderListId;
          resolvedNewIndex = Math.max(0, Math.min(latestPlaceholder.index, targetWithoutActive.length));
        }

        // WHY: on large boards DnD Kit can miss a final cross-list `over` update
        // near drop-time. If that happens, `latestPlaceholder` may still point to
        // the source list. Use the live pointer position as the final source of
        // truth for destination-list and insertion index.
        const pointerX = livePointerXRef.current;
        const pointerY = livePointerYRef.current;
        const pointerListId = getBoardListIdFromPointer(pointerX, pointerY);
        if (disableLiveDragPreview && pointerListId && lists[pointerListId] && pointerListId !== fromListId) {
          const targetWithoutActive = (finalCardsByList[pointerListId] ?? []).filter((id) => id !== activeId);
          resolvedToListId = pointerListId;
          resolvedNewIndex = getInsertIndexFromPointerY(targetWithoutActive, pointerY);
        }

        // WHY: these fallback blocks recalculate position from overId and are only
        // needed when disableLiveDragPreview=true and the placeholder was not set
        // (edge case). For live-preview mode (disableLiveDragPreview=false),
        // finalCardsByList already contains the correct order from handleDragOver,
        // so re-entering here would double-count the move and produce the wrong index
        // (e.g. same-list drag from 0→1 would set resolvedNewIndex back to 0).
        if (disableLiveDragPreview && !latestPlaceholder && cards[overId]) {
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
              const overViewportMid = getOverCardViewportMidY(overId);
              const isBelowHoverCard =
                livePointerYRef.current != null && overViewportMid != null
                  ? livePointerYRef.current >= overViewportMid - DRAG_MIDPOINT_TOLERANCE_PX
                  : false;
              resolvedNewIndex = hoverIndex + (isBelowHoverCard ? 1 : 0);
            }
          }
        } else if (disableLiveDragPreview && !latestPlaceholder && lists[overId]) {
          resolvedToListId = overId;
          resolvedNewIndex = (finalCardsByList[overId] ?? []).length;
        } else if (disableLiveDragPreview && !latestPlaceholder && overContainerId && lists[overContainerId]) {
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
    [cards, cardsByList, disableLiveDragPreview, lists, listOrder, onCardMove, onDragCommit, onDragRollback, onListReorder],
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
      collisionDetection={collisionDetection}
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
                activeDragCardId={activeCardId}
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
