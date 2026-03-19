// CalendarWeekGrid — 7-column week view for the Calendar (Sprint 53, U-CAL-02).
// Each column represents one day of the week (Sun–Sat).
// Navigation moves forward/back by 7 days. Cards are rendered as draggable chips.
import CalendarDayCell from './CalendarDayCell';
import translations from './translations/en.json';
import type { Card } from '../Card/api';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Returns "YYYY-MM-DD" for a given Date without timezone shift. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format a week range label, e.g. "Mar 9 – Mar 15, 2026". */
function weekRangeLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = MONTH_NAMES[weekStart.getMonth()]?.slice(0, 3) ?? '';
  const endMonth = MONTH_NAMES[weekEnd.getMonth()]?.slice(0, 3) ?? '';
  const year = weekEnd.getFullYear();

  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startMonth} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${year}`;
  }
  return `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()}, ${year}`;
}

export interface CalendarWeekGridProps {
  /** The Sunday that starts the displayed week (Date object, local midnight). */
  weekStart: Date;
  /** Map: "YYYY-MM-DD" → cards due on that day. */
  cardsByDay: Map<string, Card[]>;
  onPrev: () => void;
  onNext: () => void;
  onCardClick: (cardId: string) => void;
  onCardDrop?: (cardId: string, newDate: string) => void;
}

const CalendarWeekGrid = ({
  weekStart,
  cardsByDay,
  onPrev,
  onNext,
  onCardClick,
  onCardDrop,
}: CalendarWeekGridProps) => {
  // Build 7 Date objects for the week
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  function cardsForDay(date: Date): Card[] {
    return cardsByDay.get(toIsoDate(date)) ?? [];
  }

  return (
    <div className="flex flex-col gap-2 p-4" data-testid="calendar-week-grid">
      {/* Week range + navigation header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          aria-label={translations['CalendarView.ariaPrevWeek']}
          data-testid="calendar-week-prev"
          className="rounded px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none"
        >
          ‹
        </button>
        <h2 className="text-base font-semibold text-slate-100" data-testid="calendar-week-title">
          {weekRangeLabel(weekStart)}
        </h2>
        <button
          onClick={onNext}
          aria-label={translations['CalendarView.ariaNextWeek']}
          data-testid="calendar-week-next"
          className="rounded px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none"
        >
          ›
        </button>
      </div>

      {/* Weekday column headers with specific date */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => {
          const today = new Date();
          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
          return (
            <div
              key={i}
              className={[
                'py-1 text-center text-xs font-medium uppercase tracking-wide',
                isToday ? 'text-blue-400' : 'text-slate-500',
              ].join(' ')}
            >
              <div>{WEEKDAY_LABELS[i]}</div>
              <div
                className={[
                  'mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                  isToday ? 'bg-blue-600 text-white' : 'text-slate-300',
                ].join(' ')}
              >
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* 7-column day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => (
          <CalendarDayCell
            key={i}
            date={date}
            cards={cardsForDay(date)}
            isCurrentMonth={true}
            onCardClick={onCardClick}
            {...(onCardDrop ? { onCardDrop } : {})}
          />
        ))}
      </div>
    </div>
  );
};

export default CalendarWeekGrid;
