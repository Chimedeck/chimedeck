// QuotaBar — shows monthly automation run quota usage with color-coded progress bar.
// emerald → amber at ≥80% → red at ≥95%
import { ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import type { AutomationQuota } from '../../types';
import translations from '../../translations/en.json';

interface Props {
  quota: AutomationQuota;
}

function daysUntilReset(resetAt: string): number {
  const now = new Date();
  const reset = new Date(resetAt);
  const diffMs = reset.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function barColor(pct: number): string {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}

const QuotaBar: FC<Props> = ({ quota }) => {
  const { usedRuns, maxRuns, resetAt, percentUsed } = quota;
  const pct = Math.min(100, percentUsed);
  const days = daysUntilReset(resetAt);
  const isWarning = pct >= 80;

  return (
    <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <ChartBarIcon className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
        <span className="text-xs text-slate-300 font-medium">
          {usedRuns.toLocaleString()} / {maxRuns.toLocaleString()} runs used this month
        </span>
        {isWarning && (
          <ExclamationTriangleIcon
            className={`h-4 w-4 shrink-0 ${pct >= 95 ? 'text-red-400' : 'text-amber-400'}`}
            aria-label={translations['automation.quotaBar.warningAriaLabel']}
          />
        )}
      </div>

      {/* Track */}
      <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor(pct)}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pct}% quota used`}
        />
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Resets in {days} day{days !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export default QuotaBar;
