// CalendarMonthGrid — renders a 6-row × 7-column monthly calendar grid.
// Always shows 6 weeks for layout consistency (days outside the current month
// are greyed out). Prev/next navigation is handled by the parent CalendarView.
import CalendarDayCell from './CalendarDayCell';
import type { CalendarMonthGridProps } from './types';
import type { Card } from '../Card/api';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props extends CalendarMonthGridProps {
  onCardDrop?: (cardId: string, newDate: string) => void;
}

/** Build a 42-cell (6-week) grid starting on the Sunday before the 1st. */
function buildGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startDay);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return cells;
}

const CalendarMonthGrid = ({
  year,
  month,
  cardsByDay,
  onPrev,
  onNext,
  onCardClick,
  onCardDrop,
}: Props) => {
  const cells = buildGrid(year, month);

  function cardsForDay(date: Date): Card[] {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return cardsByDay.get(`${y}-${m}-${d}`) ?? [];
  }

  return (
    <div className="flex flex-col gap-2 p-4" data-testid="calendar-month-grid">
      {/* Month + navigation header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          aria-label="Previous month"
          data-testid="calendar-prev"
          className="rounded px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none"
        >
          ‹
        </button>
        <h2 className="text-base font-semibold text-slate-100" data-testid="calendar-month-title">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={onNext}
          aria-label="Next month"
          data-testid="calendar-next"
          className="rounded px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none"
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 6-week grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => (
          <CalendarDayCell
            key={i}
            date={date}
            cards={cardsForDay(date)}
            isCurrentMonth={date.getMonth() === month}
            onCardClick={onCardClick}
            onCardDrop={onCardDrop}
          />
        ))}
      </div>
    </div>
  );
};

export default CalendarMonthGrid;
