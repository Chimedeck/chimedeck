// useTimelineDrag — drag/resize interaction hook for the Timeline view (Sprint 54).
// Handles three interaction modes:
//   - 'move'         : drag the bar body → shift both start_date and due_date
//   - 'resize-left'  : drag left handle  → update start_date only
//   - 'resize-right' : drag right handle → update due_date only
// All changes are applied optimistically via PATCH /api/v1/cards/:id.
// On PATCH failure the Redux state is reverted and an error toast is shown.
import { useCallback, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { apiClient } from '~/common/api/client';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { boardSliceActions } from '../Board/slices/boardSlice';
import type { UseTimelineDragOptions, UseTimelineDragResult, TimelineDragOverride } from './types';

type DragType = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  type: DragType;
  cardId: string;
  startX: number;
  originalStartDate: string;
  originalDueDate: string;
  // Mutated live as the mouse moves, read on mouseup to commit.
  currentStartDate: string;
  currentDueDate: string;
}

function parseLocalDate(s: string): Date {
  const parts = s.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysToStr(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function useTimelineDrag({
  cards,
  dayWidth,
  addToast,
}: UseTimelineDragOptions): UseTimelineDragResult {
  const dispatch = useAppDispatch();
  const dragRef = useRef<DragState | null>(null);
  // Keep dayWidth in a ref so the event closures always see the latest value
  // without needing to be re-created on each zoom change.
  const dayWidthRef = useRef(dayWidth);
  dayWidthRef.current = dayWidth;
  // Refs to the active mousemove/mouseup listeners so we can cleanly remove them.
  const listenersRef = useRef<{
    move: (e: globalThis.MouseEvent) => void;
    up: () => void;
  } | null>(null);

  const [dragOverrides, setDragOverrides] = useState<Record<string, TimelineDragOverride>>({});

  const startDrag = useCallback(
    (type: DragType, cardId: string, e: MouseEvent) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card || !card.start_date || !card.due_date) return;

      e.preventDefault();
      e.stopPropagation();

      const origStart = card.start_date.slice(0, 10);
      const origDue = card.due_date.slice(0, 10);

      dragRef.current = {
        type,
        cardId,
        startX: e.clientX,
        originalStartDate: origStart,
        originalDueDate: origDue,
        currentStartDate: origStart,
        currentDueDate: origDue,
      };

      const onMove = (me: globalThis.MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const deltaDays = Math.round((me.clientX - drag.startX) / dayWidthRef.current);

        let newStart = origStart;
        let newDue = origDue;

        if (type === 'move') {
          newStart = addDaysToStr(origStart, deltaDays);
          newDue = addDaysToStr(origDue, deltaDays);
        } else if (type === 'resize-left') {
          newStart = addDaysToStr(origStart, deltaDays);
          // Clamp: start must not exceed due
          if (parseLocalDate(newStart) > parseLocalDate(origDue)) newStart = origDue;
        } else {
          newDue = addDaysToStr(origDue, deltaDays);
          // Clamp: due must not go before start
          if (parseLocalDate(newDue) < parseLocalDate(origStart)) newDue = origStart;
        }

        drag.currentStartDate = newStart;
        drag.currentDueDate = newDue;

        setDragOverrides((prev) => ({
          ...prev,
          [cardId]: { start_date: newStart, due_date: newDue },
        }));
      };

      const onUp = async () => {
        if (listenersRef.current) {
          document.removeEventListener('mousemove', listenersRef.current.move);
          document.removeEventListener('mouseup', listenersRef.current.up);
          listenersRef.current = null;
        }

        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;

        // Clear the optimistic override now that we're committing to Redux.
        setDragOverrides((prev) => {
          const next = { ...prev };
          delete next[cardId];
          return next;
        });

        // Nothing changed — skip the PATCH.
        if (drag.currentStartDate === origStart && drag.currentDueDate === origDue) return;

        // Apply optimistic update to Redux immediately.
        dispatch(boardSliceActions.optimisticUpdateCardField({
          cardId,
          field: 'start_date',
          value: drag.currentStartDate,
        }));
        dispatch(boardSliceActions.optimisticUpdateCardField({
          cardId,
          field: 'due_date',
          value: drag.currentDueDate,
        }));

        try {
          await apiClient.patch(`/cards/${cardId}`, {
            start_date: drag.currentStartDate,
            due_date: drag.currentDueDate,
          });
        } catch {
          // Revert Redux to original dates on API failure.
          dispatch(boardSliceActions.optimisticUpdateCardField({
            cardId,
            field: 'start_date',
            value: origStart,
          }));
          dispatch(boardSliceActions.optimisticUpdateCardField({
            cardId,
            field: 'due_date',
            value: origDue,
          }));
          addToast?.('Failed to update card dates. Changes reverted.', 'error');
        }
      };

      listenersRef.current = { move: onMove, up: onUp };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [cards, dispatch, addToast],
  );

  const handleMoveStart = useCallback(
    (cardId: string, e: MouseEvent) => startDrag('move', cardId, e),
    [startDrag],
  );

  const handleResizeLeftStart = useCallback(
    (cardId: string, e: MouseEvent) => startDrag('resize-left', cardId, e),
    [startDrag],
  );

  const handleResizeRightStart = useCallback(
    (cardId: string, e: MouseEvent) => startDrag('resize-right', cardId, e),
    [startDrag],
  );

  return { dragOverrides, handleMoveStart, handleResizeLeftStart, handleResizeRightStart };
}
