// TimelineRow — renders one horizontal swimlane for a single list.
// Scheduled cards (with both start_date and due_date) are rendered as
// draggable/resizable TimelineBar components. Unscheduled cards appear as
// clickable chips below the bar area.
import { useMemo } from 'react';
import TimelineBar, { ROW_SLOT_HEIGHT } from './TimelineBar';
import Button from '../../common/components/Button';
import { useTimelineDrag } from './useTimelineDrag';
import translations from './translations/en.json';
import type { TimelineRowProps } from './types';
import type { Card } from '../Card/api';

/** Top padding above the first sub-row (must match BAR_TOP in TimelineBar). */
const BAR_TOP = 8;
/** Bottom padding inside the bar area. */
const BAR_BOTTOM_PAD = 6;

// ── Row-packing helpers ────────────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const datePart = s.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Greedy interval-packing: assigns each card a sub-row index so that no two
 * cards in the same row overlap. Cards are sorted by start day so the
 * earliest-starting card always gets the lowest available row.
 */
function assignRows(cards: Card[], originDate: Date): Map<string, number> {
  const intervals = cards.map((card) => {
    const startStr = card.start_date ?? card.due_date!;
    const startDay = daysBetween(originDate, parseLocalDate(startStr));
    const dueDay   = daysBetween(originDate, parseLocalDate(card.due_date!));
    return { id: card.id, startDay, dueDay };
  });

  intervals.sort((a, b) => a.startDay - b.startDay);

  // rowEnd[i] = due day of the last card placed in sub-row i
  const rowEnd: number[] = [];
  const result = new Map<string, number>();

  for (const { id, startDay, dueDay } of intervals) {
    // Find the first sub-row whose last card ends strictly before this one starts
    let row = rowEnd.findIndex((end) => end < startDay);
    if (row === -1) {
      row = rowEnd.length; // need a new sub-row
      rowEnd.push(dueDay);
    } else {
      rowEnd[row] = dueDay;
    }
    result.set(id, row);
  }

  return result;
}

const TimelineRow = ({
  swimlane,
  originDate,
  totalDays,
  dayWidth,
  labelWidth,
  onCardClick,
  addToast,
}: TimelineRowProps) => {
  const totalWidth = totalDays * dayWidth;
  const hasUnscheduled = swimlane.unscheduledCards.length > 0;

  const { dragOverrides, handleMoveStart, handleResizeLeftStart, handleResizeRightStart } =
    useTimelineDrag({
      cards: swimlane.scheduledCards,
      dayWidth,
      ...(addToast !== undefined ? { addToast } : {}),
    });

  // Assign each card a sub-row so overlapping cards don't stack on top of each other.
  // Row assignments are based on the card's persisted dates (not drag overrides) so the
  // layout stays stable during a drag.
  const rowAssignments = useMemo(
    () => assignRows(swimlane.scheduledCards, originDate),
    [swimlane.scheduledCards, originDate],
  );

  const rowCount = Math.max(1, ...Array.from(rowAssignments.values()).map((r) => r + 1));
  const barAreaHeight = BAR_TOP + rowCount * ROW_SLOT_HEIGHT + BAR_BOTTOM_PAD;

  return (
    <div
      className="border-b border-border bg-bg-surface"
      // minWidth must match the header so the border-b extends across the full scrollable width.
      style={{ minWidth: labelWidth + totalWidth }}
      data-testid={`timeline-row-${swimlane.listId}`}
    >
      {/* Bar row: sticky label + scrollable bar area */}
      <div className="flex" style={{ minWidth: labelWidth + totalWidth }}>
        {/* Sticky swimlane label */}
        <div
          className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-border bg-bg-surface px-3 py-2"
          style={{ width: labelWidth, minHeight: barAreaHeight }}
          data-testid={`timeline-lane-label-${swimlane.listId}`}
        >
          <span className="truncate text-sm font-medium text-subtle">
            {swimlane.listTitle}
          </span>
          {swimlane.scheduledCards.length > 0 && (
            <span className="text-xs text-muted">
              {swimlane.scheduledCards.length} {translations['TimelineView.scheduledCount']}
            </span>
          )}
        </div>

        {/* Bar area — one TimelineBar per scheduled card */}
        <div
          className="relative"
          style={{ width: totalWidth, minHeight: barAreaHeight }}
          data-testid={`timeline-bar-area-${swimlane.listId}`}
        >
          {swimlane.scheduledCards.map((card) => (
            <TimelineBar
              key={card.id}
              card={card}
              originDate={originDate}
              dayWidth={dayWidth}
              rowIndex={rowAssignments.get(card.id) ?? 0}
              {...(dragOverrides[card.id] !== undefined ? { dragOverride: dragOverrides[card.id] } : {})}
              onCardClick={onCardClick}
              onMoveStart={handleMoveStart}
              onResizeLeftStart={handleResizeLeftStart}
              onResizeRightStart={handleResizeRightStart}
            />
          ))}
        </div>
      </div>

      {/* Unscheduled chips row */}
      {hasUnscheduled && (
        <div
          className="flex"
          style={{ minWidth: labelWidth + totalWidth }}
          data-testid={`timeline-unscheduled-row-${swimlane.listId}`}
        >
          {/* Sticky label for unscheduled section */}
          <div
            className="sticky left-0 z-10 shrink-0 border-r border-border bg-bg-surface px-3 py-1"
            style={{ width: labelWidth }}
          >
            <span className="text-xs italic text-muted">{translations['TimelineView.unscheduledLabel']}</span>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1 px-2 py-1" style={{ minWidth: totalWidth }}>
            {swimlane.unscheduledCards.map((card) => (
              <Button
                key={card.id}
                variant="ghost"
                className="rounded bg-bg-overlay px-2 py-0.5 text-xs text-subtle hover:bg-bg-sunken"
                onClick={() => onCardClick(card.id)}
                data-testid={`timeline-unscheduled-chip-${card.id}`}
              >
                {card.title}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineRow;
