// TimelineHeader — renders the horizontal date axis for the Timeline view.
// The leftmost cell is a sticky placeholder aligned with the swimlane label column.
// Date columns adapt to the current zoom level:
//   day   → one column per day, showing "Mon 10"
//   week  → one column per week (7 days), showing "Mar 10"
//   month → one column per month, showing "March 2026"
import type { TimelineHeaderProps, ZoomLevel } from './types';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface DateColumn {
  label: string;
  subLabel?: string;
  widthPx: number;
  isToday: boolean;
}

function buildDayColumns(
  originDate: Date,
  totalDays: number,
  dayWidth: number,
  today: Date,
): DateColumn[] {
  const todayIso = toIsoDate(today);
  return Array.from({ length: totalDays }, (_, i) => {
    const d = addDays(originDate, i);
    return {
      label: DAY_SHORT[d.getDay()] as string,
      subLabel: String(d.getDate()),
      widthPx: dayWidth,
      isToday: toIsoDate(d) === todayIso,
    };
  });
}

function buildWeekColumns(
  originDate: Date,
  totalDays: number,
  dayWidth: number,
  today: Date,
): DateColumn[] {
  const todayIso = toIsoDate(today);
  const cols: DateColumn[] = [];
  let i = 0;
  while (i < totalDays) {
    const d = addDays(originDate, i);
    const daysInChunk = Math.min(7, totalDays - i);
    const isCurrentWeek = Array.from({ length: daysInChunk }, (_, k) =>
      toIsoDate(addDays(d, k)),
    ).includes(todayIso);
    cols.push({
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
      widthPx: daysInChunk * dayWidth,
      isToday: isCurrentWeek,
    });
    i += 7;
  }
  return cols;
}

function buildMonthColumns(
  originDate: Date,
  totalDays: number,
  dayWidth: number,
  today: Date,
): DateColumn[] {
  const cols: DateColumn[] = [];
  let i = 0;
  while (i < totalDays) {
    const d = addDays(originDate, i);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const daysLeft = Math.floor((endOfMonth.getTime() - d.getTime()) / 86400000) + 1;
    const daysInChunk = Math.min(daysLeft, totalDays - i);
    const isCurrentMonth =
      today.getMonth() === d.getMonth() && today.getFullYear() === d.getFullYear();
    cols.push({
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      widthPx: daysInChunk * dayWidth,
      isToday: isCurrentMonth,
    });
    i += daysInChunk;
  }
  return cols;
}

function buildColumns(
  zoom: ZoomLevel,
  originDate: Date,
  totalDays: number,
  dayWidth: number,
  today: Date,
): DateColumn[] {
  if (zoom === 'day') return buildDayColumns(originDate, totalDays, dayWidth, today);
  if (zoom === 'week') return buildWeekColumns(originDate, totalDays, dayWidth, today);
  return buildMonthColumns(originDate, totalDays, dayWidth, today);
}

const TimelineHeader = ({
  zoom,
  originDate,
  totalDays,
  dayWidth,
  labelWidth,
  today,
}: TimelineHeaderProps) => {
  const columns = buildColumns(zoom, originDate, totalDays, dayWidth, today);
  const totalWidth = totalDays * dayWidth;

  return (
    <div
      className="flex shrink-0 border-b border-slate-700 bg-slate-900 text-xs text-slate-400"
      style={{ minWidth: labelWidth + totalWidth }}
      data-testid="timeline-header"
    >
      {/* Sticky placeholder aligned with swimlane label column */}
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-slate-700 bg-slate-900"
        style={{ width: labelWidth }}
      />

      {/* Date columns */}
      <div className="flex" style={{ width: totalWidth }}>
        {columns.map((col, i) => (
          <div
            key={i}
            style={{ width: col.widthPx, minWidth: col.widthPx }}
            className={`flex flex-col items-center justify-center overflow-hidden border-r border-slate-800 py-1 ${
              col.isToday ? 'bg-blue-950/40 text-blue-300' : ''
            }`}
            data-testid={col.isToday ? 'timeline-today-column' : undefined}
          >
            <span className="truncate font-medium leading-tight">{col.label}</span>
            {col.subLabel && (
              <span className="text-slate-500 leading-tight">{col.subLabel}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineHeader;
