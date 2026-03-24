// HealthCheckCountdown — displays an auto-refresh countdown ticker.
// Renders as an accessible live region so screen readers announce updates sparingly.
interface Props {
  /** Seconds remaining until the next auto-refresh. */
  secondsRemaining: number;
  /** Total interval in seconds (used to compute the progress arc width). */
  totalSeconds?: number;
  /** When true, the countdown is paused (e.g. tab is hidden). */
  paused?: boolean;
}

/** Formats raw seconds into a human-readable string: "45s" or "1m 05s". */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Refreshing…';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** Presentational countdown component for the auto-refresh timer. */
export function HealthCheckCountdown({
  secondsRemaining,
  totalSeconds = 60,
  paused = false,
}: Props) {
  const display = paused ? 'Paused' : formatCountdown(secondsRemaining);
  const progress = totalSeconds > 0 ? Math.max(0, secondsRemaining / totalSeconds) : 0;
  // Width of the progress bar as a percentage
  const widthPct = `${Math.round(progress * 100)}%`;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-slate-400"
      // Polite live region so screen readers announce the countdown without interruption.
      aria-live="polite"
      aria-atomic="true"
      title={paused ? 'Auto-refresh paused' : `Next refresh in ${display}`}
    >
      {/* Thin progress bar */}
      <span className="relative h-1 w-16 rounded-full bg-slate-700 overflow-hidden" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${
            paused ? 'bg-slate-500' : 'bg-blue-500'
          }`}
          style={{ width: widthPct }}
        />
      </span>

      <span className="sr-only">
        {paused
          ? 'Auto-refresh is paused'
          : secondsRemaining <= 0
            ? 'Refreshing now'
            : `Next refresh in ${display}`}
      </span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
