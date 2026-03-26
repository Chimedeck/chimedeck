// CalendarView — root component for the Calendar board view (Sprint 53).
// Renders the monthly calendar grid by default; a toolbar toggle switches to weekly.
// Toolbar note: cards without a due_date are not displayed.
// Drag-to-reschedule: dropping a chip on a new day fires PATCH /cards/:id
// with the new due_date (optimistic update, reverts + toast on error).
import { useState, useCallback, useMemo } from 'react';
import CalendarMonthGrid from './CalendarMonthGrid';
import CalendarWeekGrid from './CalendarWeekGrid';
import { useCalendarDrag } from './useCalendarDrag';
import translations from './translations/en.json';
import type { CalendarMode, CalendarViewProps } from './types';
import type { Card } from '../Card/api';

interface Props extends CalendarViewProps {
  addToast?: (message: string, variant?: 'error' | 'success' | 'conflict') => void;
}

/** Build a lookup map: "YYYY-MM-DD" → Card[] from a list of cards with due_date. */
function buildCardsByDay(cards: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    if (!card.due_date) continue;
    // Truncate to date portion only (handles ISO timestamps)
    const key = card.due_date.slice(0, 10);
    const existing = map.get(key) ?? [];
    map.set(key, [...existing, card]);
  }
  return map;
}

/** Returns the Sunday at the start of the week containing `date`. */
function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay()); // back up to Sunday
  return d;
}

const CalendarView = ({ cards, lists: _lists, onCardClick, addToast }: Props) => {
  const now = new Date();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(now));

  // Only cards with a due_date are shown
  const scheduledCards = useMemo(() => cards.filter((c) => !!c.due_date), [cards]);
  const cardsByDay = useMemo(() => buildCardsByDay(scheduledCards), [scheduledCards]);

  // Month navigation
  const handleMonthPrev = useCallback(() => {
    setMonth((m) => {
      if (m === 0) { setYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const handleMonthNext = useCallback(() => {
    setMonth((m) => {
      if (m === 11) { setYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Week navigation — shift by ±7 days
  const handleWeekPrev = useCallback(() => {
    setWeekStart((ws) => {
      const d = new Date(ws);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const handleWeekNext = useCallback(() => {
    setWeekStart((ws) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  // ── Drag-to-reschedule (shared between month and week grids) ──────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps -- addToast identity is stable in callers
  const { handleCardDrop } = useCalendarDrag({ cards, ...(addToast ? { addToast } : {}) });

  const hasUnscheduled = cards.length > scheduledCards.length;

  return (
    <div className="flex flex-1 flex-col overflow-auto" data-testid="calendar-view">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-sm text-subtle">
        {/* Mode toggle */}
        <div className="flex rounded border border-border" role="group" aria-label={translations['CalendarView.ariaMode']}>
          <button
            onClick={() => setMode('month')}
            className={`px-3 py-1 text-xs rounded-l ${mode === 'month' ? 'bg-blue-600 text-white' : 'text-subtle hover:text-base'}`} // [theme-exception]
            aria-pressed={mode === 'month'}
            data-testid="calendar-mode-month"
          >
            {translations['CalendarView.monthView']}
          </button>
          <button
            onClick={() => setMode('week')}
            className={`px-3 py-1 text-xs rounded-r ${mode === 'week' ? 'bg-blue-600 text-white' : 'text-subtle hover:text-base'}`} // [theme-exception]
            aria-pressed={mode === 'week'}
            data-testid="calendar-mode-week"
          >
            {translations['CalendarView.weekView']}
          </button>
        </div>

        {/* Cards-without-due-date note (always shown) */}
        <span className="text-xs text-subtle" data-testid="calendar-no-due-date-note">
          {translations['CalendarView.noDueDateNote']}
          {hasUnscheduled && (
            <> ({cards.length - scheduledCards.length} hidden)</>
          )}
        </span>
      </div>

      {/* Monthly grid */}
      {mode === 'month' && (
        <CalendarMonthGrid
          year={year}
          month={month}
          cardsByDay={cardsByDay}
          onPrev={handleMonthPrev}
          onNext={handleMonthNext}
          onCardClick={onCardClick}
          onCardDrop={handleCardDrop}
        />
      )}

      {/* Weekly grid */}
      {mode === 'week' && (
        <CalendarWeekGrid
          weekStart={weekStart}
          cardsByDay={cardsByDay}
          onPrev={handleWeekPrev}
          onNext={handleWeekNext}
          onCardClick={onCardClick}
          onCardDrop={handleCardDrop}
        />
      )}
    </div>
  );
};

export default CalendarView;
