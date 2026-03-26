// CalendarDayCell — one cell in the monthly grid.
// Shows chips for cards due on this day; excess cards collapse into "+N more".
// Accepts drag-drop events from CalendarCardChip (HTML5 drag API).
import { useState } from 'react';
import CalendarCardChip from './CalendarCardChip';
import translations from './translations/en.json';
import { MAX_CHIPS_PER_DAY } from './types';
import type { CalendarDayCellProps } from './types';
import type { Card } from '../Card/api';

interface DayDropProps extends CalendarDayCellProps {
  onCardDrop?: (cardId: string, newDate: string) => void;
}

// ISO "YYYY-MM-DD" without timezone shift
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const CalendarDayCell = ({
  date,
  cards,
  isCurrentMonth,
  onCardClick,
  onCardDrop,
}: DayDropProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const visible: Card[] = expanded ? cards : cards.slice(0, MAX_CHIPS_PER_DAY);
  const overflow = cards.length - MAX_CHIPS_PER_DAY;

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (cardId && onCardDrop) {
      onCardDrop(cardId, toIsoDate(date));
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={`calendar-day-${toIsoDate(date)}`}
      className={[
        'flex min-h-[90px] flex-col rounded-sm border p-1 transition-colors',
        isCurrentMonth ? 'border-border bg-bg-surface' : 'border-border bg-bg-base',
        isDragOver ? 'border-blue-500 bg-blue-900/20' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Day number */}
      <span
        className={[
          'mb-1 self-end rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none',
          isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-subtle' : 'text-subtle', // [theme-exception]
        ].join(' ')}
        aria-label={isToday ? translations['CalendarView.todayButton'] : undefined}
      >
        {date.getDate()}
      </span>

      {/* Card chips */}
      <div className="flex flex-col gap-0.5">
        {visible.map((card) => (
          <CalendarCardChip key={card.id} card={card} onClick={onCardClick} />
        ))}
        {!expanded && overflow > 0 && (
          // [theme-exception]: CalendarView dark theme
          <button
            onClick={() => setExpanded(true)}
            className="w-full rounded bg-bg-overlay px-1.5 py-0.5 text-left text-xs text-subtle hover:bg-bg-sunken hover:text-base focus:outline-none"
            data-testid={`calendar-day-overflow-${toIsoDate(date)}`}
          >
            +{overflow} {translations['CalendarView.overflowMore']}
          </button>
        )}
        {expanded && overflow > 0 && (
          // [theme-exception]: CalendarView dark theme
          <button
            onClick={() => setExpanded(false)}
            className="w-full rounded bg-bg-overlay px-1.5 py-0.5 text-left text-xs text-subtle hover:bg-bg-sunken hover:text-base focus:outline-none"
          >
            {translations['CalendarView.showLess']}
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarDayCell;
