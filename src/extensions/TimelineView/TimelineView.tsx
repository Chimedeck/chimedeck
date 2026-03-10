// TimelineView — root component for the Timeline (Gantt-style) board view (Sprint 54).
// Displays a scrollable horizontal date axis (TimelineHeader) with one swimlane per list
// (TimelineRow). Cards with both start_date and due_date are scheduled (bars rendered in
// Iteration 7). Cards missing either date appear as unscheduled chips below their swimlane.
// The Today button scrolls the timeline so the current date is centred in the viewport.
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import TimelineHeader from './TimelineHeader';
import TimelineRow from './TimelineRow';
import TimelineZoomControl from './TimelineZoomControl';
import type { TimelineViewProps, ZoomLevel, Swimlane } from './types';

/** Days to render before today — determines the origin of the date axis. */
const DAYS_BEFORE_TODAY = 90;
/** Total number of days in the timeline window (90 before + 275 after ≈ 1 year). */
const TIMELINE_DAYS = 365;
/** Width in pixels per day at each zoom level. */
const DAY_WIDTH: Record<ZoomLevel, number> = {
  day: 60,
  week: 14,
  month: 4,
};
/** Fixed width of the sticky swimlane label column (px). */
const LABEL_WIDTH = 160;

const TimelineView = ({ cards, lists, onCardClick, addToast: _addToast }: TimelineViewProps) => {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // The first day rendered on the timeline axis.
  const originDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - DAYS_BEFORE_TODAY);
    return d;
  }, [today]);

  const dayWidth = DAY_WIDTH[zoom];

  // Centre today in the viewport on mount and whenever zoom changes.
  const scrollToToday = useCallback(() => {
    if (!scrollRef.current) return;
    const viewportWidth = scrollRef.current.clientWidth - LABEL_WIDTH;
    const todayOffset = DAYS_BEFORE_TODAY * dayWidth - viewportWidth / 2;
    scrollRef.current.scrollLeft = Math.max(0, todayOffset);
  }, [dayWidth]);

  // Auto-scroll to today when component first mounts or zoom changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToToday(); }, [zoom]);

  // Group cards into swimlanes (one per list).
  const swimlanes: Swimlane[] = useMemo(() => {
    return Object.values(lists).map((list) => {
      const listCards = cards.filter((c) => c.list_id === list.id);
      return {
        listId: list.id,
        listTitle: list.title,
        // A card is "scheduled" only when it has both dates — otherwise it is unscheduled.
        scheduledCards: listCards.filter((c) => !!c.start_date && !!c.due_date),
        unscheduledCards: listCards.filter((c) => !c.start_date || !c.due_date),
      };
    });
  }, [cards, lists]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="timeline-view">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-2">
        <button
          onClick={scrollToToday}
          className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
          data-testid="timeline-today-button"
        >
          Today
        </button>
        <TimelineZoomControl zoom={zoom} onZoomChange={setZoom} />
      </div>

      {/* Horizontally scrollable timeline canvas */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col overflow-x-auto overflow-y-auto"
        data-testid="timeline-scroll"
      >
        <TimelineHeader
          zoom={zoom}
          originDate={originDate}
          totalDays={TIMELINE_DAYS}
          dayWidth={dayWidth}
          labelWidth={LABEL_WIDTH}
          today={today}
        />

        {swimlanes.map((lane) => (
          <TimelineRow
            key={lane.listId}
            swimlane={lane}
            zoom={zoom}
            originDate={originDate}
            totalDays={TIMELINE_DAYS}
            dayWidth={dayWidth}
            labelWidth={LABEL_WIDTH}
            today={today}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
};

export default TimelineView;
