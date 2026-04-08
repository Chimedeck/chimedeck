// TimelineHeader — renders the horizontal date axis for the Timeline view.
// The leftmost cell is a sticky placeholder aligned with the swimlane label column.
// Date columns adapt to the current zoom level:
//   day   → 2-tier: month band on top row, individual day columns on bottom row
//   week  → one column per week showing start–end range e.g. "Mar 10 – 16"
//   month → one column per month, showing "Mar 2026"
import type { TimelineHeaderProps } from './types';

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
  dateKey: string;
  label: string;
  subLabel?: string;
  widthPx: number;
  isToday: boolean;
}

interface MonthBand {
  dateKey: string;
  label: string;
  widthPx: number;
}

/** Build the month-spanning bands used as the top tier in day zoom. */
function buildMonthBands(originDate: Date, totalDays: number, dayWidth: number): MonthBand[] {
  const bands: MonthBand[] = [];
  let i = 0;
  while (i < totalDays) {
    const d = addDays(originDate, i);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const daysLeft = Math.floor((endOfMonth.getTime() - d.getTime()) / 86400000) + 1;
    const daysInChunk = Math.min(daysLeft, totalDays - i);
    bands.push({
      dateKey: toIsoDate(d),
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      widthPx: daysInChunk * dayWidth,
    });
    i += daysInChunk;
  }
  return bands;
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
      dateKey: toIsoDate(d),
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
    const endDate = addDays(d, daysInChunk - 1);
    const isCurrentWeek = Array.from({ length: daysInChunk }, (_, k) =>
      toIsoDate(addDays(d, k)),
    ).includes(todayIso);
    // Show the week range: "Mar 10 – 16" or "Mar 29 – Apr 4" when spanning a month boundary.
    const startLabel = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    const endLabel =
      endDate.getMonth() === d.getMonth()
        ? String(endDate.getDate())
        : `${MONTH_SHORT[endDate.getMonth()]} ${endDate.getDate()}`;
    cols.push({
      dateKey: toIsoDate(d),
      label: `${startLabel} – ${endLabel}`,
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
      dateKey: toIsoDate(d),
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      widthPx: daysInChunk * dayWidth,
      isToday: isCurrentMonth,
    });
    i += daysInChunk;
  }
  return cols;
}

/** Shared sticky label-column placeholder rendered in each header tier. */
const StickyPlaceholder = ({ width }: { width: number }) => (
  <div
    className="sticky left-0 z-10 shrink-0 border-r border-border bg-bg-surface"
    style={{ width }}
  />
);

const TimelineHeader = ({
  zoom,
  originDate,
  totalDays,
  dayWidth,
  labelWidth,
  today,
}: TimelineHeaderProps) => {
  const totalWidth = totalDays * dayWidth;

  // Day zoom: 2-tier header — month band on top, individual day columns below.
  if (zoom === 'day') {
    const monthBands = buildMonthBands(originDate, totalDays, dayWidth);
    const dayColumns = buildDayColumns(originDate, totalDays, dayWidth, today);

    return (
      <div
        className="flex shrink-0 flex-col border-b border-border bg-bg-surface text-xs text-subtle"
        style={{ minWidth: labelWidth + totalWidth }}
        data-testid="timeline-header"
      >
        {/* Top tier: month bands */}
        <div className="flex border-b border-border/60">
          <StickyPlaceholder width={labelWidth} />
          <div className="flex" style={{ width: totalWidth }}>
            {monthBands.map((band) => (
              <div
                key={band.dateKey}
                style={{ width: band.widthPx, minWidth: band.widthPx }}
                className="overflow-hidden border-r border-border px-2 py-0.5 font-semibold text-subtle"
              >
                {band.label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tier: individual day columns */}
        <div className="flex">
          <StickyPlaceholder width={labelWidth} />
          <div className="flex" style={{ width: totalWidth }}>
            {dayColumns.map((col) => (
              <div
                key={col.dateKey}
                style={{ width: col.widthPx, minWidth: col.widthPx }}
                className={`flex flex-col items-center justify-center overflow-hidden border-r border-border py-1 ${
                  col.isToday ? 'bg-blue-950/40 text-blue-300' : ''
                }`}
                data-testid={col.isToday ? 'timeline-today-column' : undefined}
              >
                <span className="font-medium leading-tight">{col.label}</span>
                {col.subLabel && (
                  <span className="text-muted leading-tight">{col.subLabel}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Week / month zoom: single-tier header.
  const columns =
    zoom === 'week'
      ? buildWeekColumns(originDate, totalDays, dayWidth, today)
      : buildMonthColumns(originDate, totalDays, dayWidth, today);

  return (
    <div
      className="flex shrink-0 border-b border-border bg-bg-surface text-xs text-subtle"
      style={{ minWidth: labelWidth + totalWidth }}
      data-testid="timeline-header"
    >
      <StickyPlaceholder width={labelWidth} />

      <div className="flex" style={{ width: totalWidth }}>
        {columns.map((col) => (
          <div
            key={col.dateKey}
            style={{ width: col.widthPx, minWidth: col.widthPx }}
            className={`flex flex-col items-center justify-center overflow-hidden border-r border-border py-1 ${
              col.isToday ? 'bg-blue-950/40 text-blue-300' : ''
            }`}
            data-testid={col.isToday ? 'timeline-today-column' : undefined}
          >
            <span className="truncate font-medium leading-tight">{col.label}</span>
            {col.subLabel && (
              <span className="text-muted leading-tight">{col.subLabel}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineHeader;
