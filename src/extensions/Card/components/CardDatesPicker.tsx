// CardDatesPicker — Trello-style date picker panel with calendar, start/due inputs, and Save/Remove.
import { useState, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { CheckIcon } from '@heroicons/react/24/solid';
import { XMarkIcon } from '@heroicons/react/24/outline';

// ─── helpers ───────────────────────────────────────────────────────────────
function parseDate(s: string): Date | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return undefined;
  const date = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateInput(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function parseTime12(s: string): [number, number] | undefined {
  const m = /^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i.exec(s.trim());
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = (m[3] ?? '').toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return undefined;
  return [h, min];
}

export function formatTime12(h: number, min: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── DayPicker dark-themed classNames ─────────────────────────────────────
const DPC: Partial<Record<string, string>> = {
  root: 'select-none w-full',
  months: 'flex',
  month: 'w-full',
  month_caption: 'flex items-center justify-center h-8 relative mb-1',
  caption_label: 'text-sm font-semibold text-slate-200',
  nav: 'absolute inset-x-0 top-0 flex justify-between items-center pointer-events-none',
  button_previous:
    'h-8 w-8 flex items-center justify-center rounded text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-colors pointer-events-auto',
  button_next:
    'h-8 w-8 flex items-center justify-center rounded text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-colors pointer-events-auto',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday: 'text-center text-[11px] font-medium text-slate-500 pb-1 w-9',
  week: '',
  day: 'p-0 w-9 h-8 text-center align-middle',
  day_button:
    'h-8 w-8 rounded-full text-xs text-slate-300 hover:bg-slate-600 hover:text-white transition-colors focus:outline-none',
  today: '!font-bold !text-blue-400',
  outside: 'opacity-40',
  disabled: 'opacity-25 pointer-events-none',
};

// ─── component ─────────────────────────────────────────────────────────────
export interface CardDatesPickerProps {
  startDate: string | null;
  dueDate: string | null;
  disabled?: boolean;
  onSave: (startDate: string | null, dueDate: string | null) => void;
  onRemove: () => void;
  onClose: () => void;
}

export const CardDatesPicker = ({
  startDate,
  dueDate,
  disabled,
  onSave,
  onRemove,
  onClose,
}: CardDatesPickerProps) => {
  const initDue = dueDate ? new Date(dueDate) : undefined;
  const initStart = startDate ? new Date(startDate) : undefined;

  const [startEnabled, setStartEnabled] = useState(!!initStart);
  const [draftStart, setDraftStart] = useState<Date | undefined>(initStart);
  const [startInput, setStartInput] = useState(initStart ? formatDateInput(initStart) : '');

  const [draftDue, setDraftDue] = useState<Date | undefined>(initDue);
  const [dueInput, setDueInput] = useState(initDue ? formatDateInput(initDue) : '');
  const [timeInput, setTimeInput] = useState(() =>
    initDue ? formatTime12(initDue.getHours(), initDue.getMinutes()) : '12:00 PM',
  );

  const [month, setMonth] = useState<Date>(initDue ?? initStart ?? new Date());
  const [activeField, setActiveField] = useState<'start' | 'due'>('due');

  // Calendar day click
  const handleDayClick = useCallback(
    (day: Date) => {
      const str = formatDateInput(day);
      if (activeField === 'start') {
        setDraftStart(day);
        setStartInput(str);
        setActiveField('due');
      } else {
        setDraftDue(day);
        setDueInput(str);
      }
    },
    [activeField],
  );

  const handleStartBlur = () => {
    const p = parseDate(startInput);
    setDraftStart(p);
    if (p) setStartInput(formatDateInput(p));
  };

  const handleDueBlur = () => {
    const p = parseDate(dueInput);
    setDraftDue(p);
    if (p) setDueInput(formatDateInput(p));
  };

  const handleStartToggle = () => {
    if (startEnabled) {
      setStartEnabled(false);
      setDraftStart(undefined);
      setStartInput('');
    } else {
      setStartEnabled(true);
      setActiveField('start');
    }
  };

  const handleDueToggle = () => {
    if (draftDue) {
      setDraftDue(undefined);
      setDueInput('');
    }
    setActiveField('due');
  };

  const handleSave = () => {
    let startISO: string | null = null;
    if (startEnabled && draftStart) {
      startISO = new Date(
        draftStart.getFullYear(), draftStart.getMonth(), draftStart.getDate(),
      ).toISOString();
    }
    let dueISO: string | null = null;
    if (draftDue) {
      const t = parseTime12(timeInput) ?? [12, 0];
      dueISO = new Date(
        draftDue.getFullYear(), draftDue.getMonth(), draftDue.getDate(), t[0], t[1],
      ).toISOString();
    }
    onSave(startISO, dueISO);
  };

  // Calendar modifiers
  const isDue = useCallback((d: Date) => !!draftDue && isSameDay(d, draftDue), [draftDue]);
  const isStart = useCallback(
    (d: Date) => startEnabled && !!draftStart && isSameDay(d, draftStart),
    [startEnabled, draftStart],
  );
  const isInRange = useCallback(
    (d: Date) => {
      if (!startEnabled || !draftStart || !draftDue) return false;
      return d > draftStart && d < draftDue;
    },
    [startEnabled, draftStart, draftDue],
  );

  const hasAnyDate = !!draftDue || (startEnabled && !!draftStart);

  return (
    <div className="w-72 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
        <span className="text-sm font-semibold text-slate-200">Dates</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          aria-label="Close dates picker"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar */}
      <div className="px-2 pt-2 pb-1">
        <DayPicker
          classNames={DPC}
          month={month}
          onMonthChange={setMonth}
          onDayClick={handleDayClick}
          showOutsideDays
          modifiers={{ due_sel: isDue, start_sel: isStart, in_range: isInRange }}
          modifiersClassNames={{
            due_sel: '!bg-blue-600 !text-white hover:!bg-blue-500',
            start_sel: '!bg-slate-500 !text-white hover:!bg-slate-400',
            in_range: '!bg-blue-900/50 !text-blue-200 !rounded-none',
          }}
        />
      </div>

      {/* Date inputs */}
      <div className="px-4 pb-4 space-y-3">
        {/* Start date */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1.5">Start date</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartToggle}
              disabled={disabled}
              className={`flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
                startEnabled ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-500'
              }`}
              aria-label="Toggle start date"
            >
              {startEnabled && <CheckIcon className="h-2.5 w-2.5 text-white" aria-hidden="true" />}
            </button>
            <input
              type="text"
              placeholder="M/D/YYYY"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onFocus={() => { setActiveField('start'); setStartEnabled(true); }}
              onBlur={handleStartBlur}
              disabled={disabled}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Due date */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1.5">Due date</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDueToggle}
              disabled={disabled}
              className={`flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
                draftDue ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-500'
              }`}
              aria-label="Toggle due date"
            >
              {draftDue && <CheckIcon className="h-2.5 w-2.5 text-white" aria-hidden="true" />}
            </button>
            <input
              type="text"
              placeholder="M/D/YYYY"
              value={dueInput}
              onChange={(e) => setDueInput(e.target.value)}
              onFocus={() => setActiveField('due')}
              onBlur={handleDueBlur}
              disabled={disabled}
              className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <input
              type="text"
              placeholder="H:MM AM"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              disabled={!draftDue || disabled}
              className="w-24 flex-shrink-0 bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="pt-1 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            Save
          </button>
          {hasAnyDate && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
