// TimelineBar — renders a single card as a horizontal coloured bar spanning
// its start_date to due_date. Includes left/right resize handles and a
// body drag handle. Drag logic is wired in by the parent via the onMove/
// onResizeLeft/onResizeRight callbacks (provided by useTimelineDrag).
//
// TODO: dependency arrows — deferred to a future sprint.
import type { TimelineBarProps } from './types';

/** Width of each resize handle in pixels. */
const HANDLE_WIDTH = 8;
/** Height of the bar in pixels. */
const BAR_HEIGHT = 28;
/** Top offset of the bar within its 44 px row. */
const BAR_TOP = 8;
/** Default bar colour when the card has no labels. */
const DEFAULT_COLOR = '#3b82f6';
/** Minimum bar width in pixels (ensures handles are always reachable). */
const MIN_BAR_WIDTH = HANDLE_WIDTH * 2 + 8;

function parseLocalDate(s: string): Date {
  const parts = s.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

const TimelineBar = ({
  card,
  originDate,
  dayWidth,
  dragOverride,
  onCardClick,
  onMoveStart,
  onResizeLeftStart,
  onResizeRightStart,
}: TimelineBarProps) => {
  // Prefer live drag overrides so the bar tracks the mouse during drag.
  const startDateStr = (dragOverride?.start_date ?? card.start_date)!;
  const dueDateStr = (dragOverride?.due_date ?? card.due_date)!;

  const startDate = parseLocalDate(startDateStr);
  const dueDate = parseLocalDate(dueDateStr);

  const startDay = daysBetween(originDate, startDate);
  // Include the due date day in the bar span (+1).
  const durationDays = Math.max(daysBetween(startDate, dueDate) + 1, 1);

  const left = startDay * dayWidth;
  const width = Math.max(durationDays * dayWidth, MIN_BAR_WIDTH);

  // Use the first label colour when available, otherwise the default blue.
  const barColor = card.labels?.[0]?.color ?? DEFAULT_COLOR;

  return (
    <div
      data-testid={`timeline-bar-${card.id}`}
      className="absolute flex items-center rounded text-xs text-white shadow select-none"
      style={{
        left,
        width,
        top: BAR_TOP,
        height: BAR_HEIGHT,
        backgroundColor: barColor,
        cursor: 'grab',
        overflow: 'hidden',
      }}
    >
      {/* Left resize handle — changes start_date */}
      <div
        data-testid={`timeline-bar-resize-left-${card.id}`}
        onMouseDown={(e) => { e.stopPropagation(); onResizeLeftStart(card.id, e); }}
        className="flex h-full shrink-0 cursor-ew-resize items-center justify-center hover:bg-black/20"
        style={{ width: HANDLE_WIDTH }}
        aria-label="Resize start date"
      >
        <div className="h-3 w-px rounded bg-white/60" />
      </div>

      {/* Bar body — drag to move both dates */}
      <div
        onMouseDown={(e) => onMoveStart(card.id, e)}
        onClick={() => onCardClick(card.id)}
        className="flex flex-1 cursor-grab items-center overflow-hidden px-1"
        role="button"
        tabIndex={0}
        aria-label={card.title}
      >
        <span className="truncate">{card.title}</span>
      </div>

      {/* Right resize handle — changes due_date */}
      <div
        data-testid={`timeline-bar-resize-right-${card.id}`}
        onMouseDown={(e) => { e.stopPropagation(); onResizeRightStart(card.id, e); }}
        className="flex h-full shrink-0 cursor-ew-resize items-center justify-center hover:bg-black/20"
        style={{ width: HANDLE_WIDTH }}
        aria-label="Resize due date"
      >
        <div className="h-3 w-px rounded bg-white/60" />
      </div>
    </div>
  );
};

export default TimelineBar;
