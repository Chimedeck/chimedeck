// scheduleSummary — pure functions to convert schedule/due-date configs into human-readable strings.

export type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ScheduleConfig {
  scheduleType: ScheduleType;
  /** 0 = Sunday, 1 = Monday … 6 = Saturday (weekly only) */
  dayOfWeek?: number;
  /** 1–31 or 'last' (monthly only) */
  dayOfMonth?: number | 'last';
  /** 1–12 (yearly only) */
  month?: number;
  /** 0–23 UTC */
  hour: number;
  /** 0–59 */
  minute: number;
}

export type TriggerMoment = 'before' | 'on' | 'after';

export interface DueDateConfig {
  /** Positive integer (ignored when triggerMoment === 'on') */
  offsetValue?: number;
  offsetUnit?: 'days' | 'hours';
  triggerMoment: TriggerMoment;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function timeStr(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/**
 * Converts a schedule config into a human-readable summary.
 *
 * Examples:
 *   scheduleSummary({ scheduleType: 'weekly', dayOfWeek: 1, hour: 9, minute: 0 })
 *   → "Every Monday at 09:00"
 *
 *   scheduleSummary({ scheduleType: 'monthly', dayOfMonth: 1, hour: 8, minute: 30 })
 *   → "1st of every month at 08:30"
 *
 *   scheduleSummary({ scheduleType: 'monthly', dayOfMonth: 'last', hour: 17, minute: 0 })
 *   → "Last day of every month at 17:00"
 */
export function scheduleSummary(config: ScheduleConfig): string {
  const time = timeStr(config.hour, config.minute);

  switch (config.scheduleType) {
    case 'daily':
      return `Every day at ${time}`;

    case 'weekly': {
      const dayName = config.dayOfWeek !== undefined ? DAY_NAMES[config.dayOfWeek] : 'day';
      return `Every ${dayName} at ${time}`;
    }

    case 'monthly': {
      if (config.dayOfMonth === 'last') {
        return `Last day of every month at ${time}`;
      }
      const day = config.dayOfMonth ?? 1;
      return `${ordinal(day)} of every month at ${time}`;
    }

    case 'yearly': {
      const monthName = config.month !== undefined ? MONTH_NAMES[config.month - 1] : 'year';
      if (config.dayOfMonth === 'last') {
        return `Last day of ${monthName} every year at ${time}`;
      }
      const day = config.dayOfMonth ?? 1;
      return `${ordinal(day)} of ${monthName} every year at ${time}`;
    }

    default:
      return `Scheduled at ${time}`;
  }
}

/**
 * Converts a due-date trigger config into a human-readable summary.
 *
 * Examples:
 *   dueDateSummary({ offsetValue: 2, offsetUnit: 'days', triggerMoment: 'before' })
 *   → "2 days before due date"
 *
 *   dueDateSummary({ triggerMoment: 'on' })
 *   → "On the due date"
 *
 *   dueDateSummary({ offsetValue: 1, offsetUnit: 'hours', triggerMoment: 'after' })
 *   → "1 hour after due date"
 */
export function dueDateSummary(config: DueDateConfig): string {
  if (config.triggerMoment === 'on') {
    return 'On the due date';
  }

  const value = config.offsetValue ?? 1;
  const unit = config.offsetUnit ?? 'days';
  // Use singular form for value === 1
  const unitLabel = value === 1 ? unit.replace(/s$/, '') : unit;
  const direction = config.triggerMoment === 'before' ? 'before' : 'after';

  return `${value} ${unitLabel} ${direction} due date`;
}
