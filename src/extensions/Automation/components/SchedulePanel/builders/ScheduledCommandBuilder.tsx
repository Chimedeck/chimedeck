// ScheduledCommandBuilder — 3-step modal for creating/editing SCHEDULED automations.
// Steps: 1. Schedule config  2. Actions (list/board-scoped)  3. Name & Save
import { useState, useMemo } from 'react';
import {
  XMarkIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { FC } from 'react';
import ActionList from '../../AutomationPanel/RuleBuilder/ActionList';
import type { ActionItemData } from '../../AutomationPanel/RuleBuilder/ActionItem';
import { createAutomation, updateAutomation } from '../../../api';
import type { Automation } from '../../../types';
import {
  scheduleSummary,
  type ScheduleType,
  type ScheduleConfig,
} from '../../../utils/scheduleSummary';

interface Props {
  boardId: string;
  existing?: Automation;
  /** Pre-populated config (e.g. from a quick-start template). */
  initialConfig?: Partial<ScheduleConfig>;
  onSave: (automation: Automation) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_OF_WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Extract schedule config stored in automation.trigger.config */
function parseExistingSchedule(a?: Automation): Partial<ScheduleConfig> {
  if (!a?.trigger?.config) return {};
  return a.trigger.config as Partial<ScheduleConfig>;
}

const ScheduledCommandBuilder: FC<Props> = ({
  boardId,
  existing,
  initialConfig,
  onSave,
  onClose,
}) => {
  const existingSchedule = parseExistingSchedule(existing);
  const merged = { ...existingSchedule, ...initialConfig };

  // Step state: 1 | 2 | 3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — schedule config
  const [frequency, setFrequency] = useState<ScheduleType>(
    (merged.scheduleType as ScheduleType) ?? 'weekly',
  );
  const [dayOfWeek, setDayOfWeek] = useState<number>(merged.dayOfWeek ?? 1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number | 'last'>(merged.dayOfMonth ?? 1);
  const [month, setMonth] = useState<number>(merged.month ?? 1);
  const [hour, setHour] = useState<number>(merged.hour ?? 9);
  const [minute, setMinute] = useState<number>(merged.minute ?? 0);

  // Step 2 — actions
  const [actions, setActions] = useState<ActionItemData[]>(
    existing?.actions.map((a) => ({
      id: a.id,
      actionType: a.actionType,
      label: a.actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      config: a.config as Record<string, unknown>,
    })) ??
      initialConfig
        ? []
        : [],
  );

  // Step 3 — name (auto-generated or overridden)
  const [nameOverride, setNameOverride] = useState<string | null>(
    existing?.name ?? null,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the schedule config for summary + save.
  // Spread conditionally to satisfy exactOptionalPropertyTypes.
  const scheduleConfig: ScheduleConfig = useMemo(
    () => ({
      scheduleType: frequency,
      ...(frequency === 'weekly' ? { dayOfWeek } : {}),
      ...(frequency === 'monthly' || frequency === 'yearly' ? { dayOfMonth } : {}),
      ...(frequency === 'yearly' ? { month } : {}),
      hour,
      minute,
    }),
    [frequency, dayOfWeek, dayOfMonth, month, hour, minute],
  );

  const autoSummary = scheduleSummary(scheduleConfig);
  const commandName = nameOverride !== null ? nameOverride : autoSummary;

  const canProceedStep1 = true; // schedule config always has valid defaults
  const canProceedStep2 = actions.length > 0;
  const canSave = commandName.trim().length > 0 && canProceedStep2;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const actionsPayload = actions.map((a, i) => ({
        actionType: a.actionType,
        position: i,
        config: a.config,
      }));

      const triggerConfig: Record<string, unknown> = {
        scheduleType: scheduleConfig.scheduleType,
        hour: scheduleConfig.hour,
        minute: scheduleConfig.minute,
      };
      if (scheduleConfig.dayOfWeek !== undefined) triggerConfig.dayOfWeek = scheduleConfig.dayOfWeek;
      if (scheduleConfig.dayOfMonth !== undefined) triggerConfig.dayOfMonth = scheduleConfig.dayOfMonth;
      if (scheduleConfig.month !== undefined) triggerConfig.month = scheduleConfig.month;

      if (existing) {
        const res = await updateAutomation({
          boardId,
          automationId: existing.id,
          patch: {
            name: commandName.trim(),
            trigger: { triggerType: 'schedule', config: triggerConfig },
            actions: actionsPayload,
          },
        });
        onSave(res.data);
      } else {
        const res = await createAutomation({
          boardId,
          payload: {
            name: commandName.trim(),
            automationType: 'SCHEDULED',
            trigger: { triggerType: 'schedule', config: triggerConfig },
            actions: actionsPayload,
          },
        });
        onSave(res.data);
      }
    } catch {
      setError('Failed to save scheduled command. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // --- Render helpers ---

  const stepLabel = (n: 1 | 2 | 3) =>
    (['Schedule', 'Actions', 'Save'] as const)[n - 1];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={existing ? 'Edit scheduled command' : 'New scheduled command'}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-4">
          <CalendarDaysIcon className="h-5 w-5 text-blue-400 flex-shrink-0" aria-hidden="true" />
          <h2 className="flex-1 text-base font-semibold text-slate-100">
            {existing ? 'Edit Scheduled Command' : 'New Scheduled Command'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-0">
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="flex items-center gap-1">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === n
                    ? 'bg-blue-600 text-white'
                    : step > n
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {n}
              </div>
              <span
                className={`text-xs ${step === n ? 'text-slate-200' : 'text-slate-500'}`}
              >
                {stepLabel(n)}
              </span>
              {n < 3 && <span className="mx-1 text-slate-600 text-xs">›</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 max-h-[60vh]">
          {/* ── Step 1: Schedule config ── */}
          {step === 1 && (
            <>
              {/* Frequency */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Frequency
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as ScheduleType[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`rounded-md py-2 text-xs font-medium capitalize transition-colors ${
                        frequency === f
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day of week (weekly) */}
              {frequency === 'weekly' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Day
                  </label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_OF_WEEK.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        title={DAY_OF_WEEK_FULL[i]}
                        onClick={() => setDayOfWeek(i)}
                        className={`rounded py-1.5 text-xs font-medium transition-colors ${
                          dayOfWeek === i
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Day of month (monthly / yearly) */}
              {(frequency === 'monthly' || frequency === 'yearly') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Day of month
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={dayOfMonth === 'last' ? 'last' : String(dayOfMonth)}
                      onChange={(e) =>
                        setDayOfMonth(e.target.value === 'last' ? 'last' : Number(e.target.value))
                      }
                      className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      <option value="last">Last day</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Month (yearly) */}
              {frequency === 'yearly' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Month
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December',
                    ].map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Time (your browser timezone)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                    className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Hour"
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400 font-bold">:</span>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(Number(e.target.value))}
                    className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Minute"
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live preview */}
              <p className="text-xs text-slate-400 italic">
                Preview: <span className="text-slate-200">{autoSummary}</span>
              </p>
            </>
          )}

          {/* ── Step 2: Actions ── */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-400">
                These actions run for the entire board (or a specific list). Only list and board-scoped actions are available here.
              </p>
              <ActionList actions={actions} onChange={setActions} />
              {actions.length === 0 && (
                <p className="text-xs text-amber-400">Add at least one action to continue.</p>
              )}
            </div>
          )}

          {/* ── Step 3: Name & Save ── */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-300">
                <span className="text-xs text-slate-500 block mb-1">Schedule summary</span>
                {autoSummary}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="schedule-name" className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Command name
                </label>
                <input
                  id="schedule-name"
                  type="text"
                  value={commandName}
                  onChange={(e) => setNameOverride(e.target.value)}
                  maxLength={120}
                  className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-generated name"
                />
                <p className="text-xs text-slate-500">
                  You can customise the name or leave it as the auto-generated summary.
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700 px-5 py-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as 1 | 2 | 3)}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            {step === 1 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                Back
              </>
            )}
          </button>

          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              className="flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={handleSave}
              className="rounded-md px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : existing ? 'Save changes' : 'Create command'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduledCommandBuilder;
