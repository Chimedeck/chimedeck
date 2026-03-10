// TimelineRow — renders one horizontal swimlane for a single list.
// Scheduled cards (with both start_date and due_date) are rendered as
// draggable/resizable TimelineBar components. Unscheduled cards appear as
// clickable chips below the bar area.
import TimelineBar from './TimelineBar';
import { useTimelineDrag } from './useTimelineDrag';
import type { TimelineRowProps } from './types';

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

  return (
    <div
      className="border-b border-slate-800"
      data-testid={`timeline-row-${swimlane.listId}`}
    >
      {/* Bar row: sticky label + scrollable bar area */}
      <div className="flex" style={{ minWidth: labelWidth + totalWidth }}>
        {/* Sticky swimlane label */}
        <div
          className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-slate-700 bg-slate-900 px-3 py-2"
          style={{ width: labelWidth, minHeight: 44 }}
          data-testid={`timeline-lane-label-${swimlane.listId}`}
        >
          <span className="truncate text-sm font-medium text-slate-300">
            {swimlane.listTitle}
          </span>
          {swimlane.scheduledCards.length > 0 && (
            <span className="text-xs text-slate-500">
              {swimlane.scheduledCards.length} scheduled
            </span>
          )}
        </div>

        {/* Bar area — one TimelineBar per scheduled card */}
        <div
          className="relative"
          style={{ width: totalWidth, minHeight: 44 }}
          data-testid={`timeline-bar-area-${swimlane.listId}`}
        >
          {swimlane.scheduledCards.map((card) => (
            <TimelineBar
              key={card.id}
              card={card}
              originDate={originDate}
              dayWidth={dayWidth}
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
            className="sticky left-0 z-10 shrink-0 border-r border-slate-700 bg-slate-900 px-3 py-1"
            style={{ width: labelWidth }}
          >
            <span className="text-xs italic text-slate-500">unscheduled</span>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1 px-2 py-1" style={{ minWidth: totalWidth }}>
            {swimlane.unscheduledCards.map((card) => (
              <button
                key={card.id}
                onClick={() => onCardClick(card.id)}
                data-testid={`timeline-unscheduled-chip-${card.id}`}
                className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-600"
              >
                {card.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineRow;
