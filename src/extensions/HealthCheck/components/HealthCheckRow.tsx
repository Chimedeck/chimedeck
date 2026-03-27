// HealthCheckRow — single row in the health check dashboard.
// Displays status dot, service name, URL, response time, last-checked time, and a remove button.
import { TrashIcon } from '@heroicons/react/24/outline';
import { HealthCheckStatusDot } from './HealthCheckStatusDot';
import type { HealthCheck } from '../api';

interface Props {
  entry: HealthCheck;
  isProbing: boolean;
  onRemove: (id: string) => void;
}

/** Formats a response time value into a display string. */
function formatResponseTime(
  status: string | null | undefined,
  responseTimeMs: number | null | undefined,
  errorMessage: string | null | undefined,
): string {
  if (!status || status === 'unknown') return '—';
  if (status === 'red') {
    if (errorMessage?.toLowerCase().includes('timeout')) return 'Timeout';
    if (errorMessage) return 'Error';
    return 'Error';
  }
  if (responseTimeMs != null) return `${responseTimeMs} ms`;
  return '—';
}

/** Returns a relative-time string like "2 min ago" or "just now". */
function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function HealthCheckRow({ entry, isProbing, onRemove }: Props) {
  const result = entry.latestResult;
  const responseTime = formatResponseTime(
    result?.status,
    result?.responseTimeMs,
    result?.errorMessage,
  );

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-overlay transition-colors"
      role="row"
    >
      {/* Status dot or loading spinner */}
      <div className="flex-shrink-0 w-5 flex items-center justify-center">
        {isProbing ? (
          <span
            className="h-3 w-3 rounded-full border-2 border-muted border-t-transparent animate-spin"
            aria-label="Probing…"
            role="status"
          />
        ) : (
          <HealthCheckStatusDot
            status={result?.status ?? null}
            httpStatus={result?.httpStatus}
            responseTimeMs={result?.responseTimeMs}
            errorMessage={result?.errorMessage}
          />
        )}
      </div>

      {/* Name */}
      <span
        className="flex-shrink-0 w-40 truncate text-sm font-medium text-muted"
        title={entry.name}
      >
        {entry.name}
      </span>

      {/* URL */}
      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 truncate text-sm text-muted transition-colors"
        title={entry.url}
      >
        {entry.url}
      </a>

      {/* Response time */}
      <span className="flex-shrink-0 w-24 text-right text-sm text-muted tabular-nums">
        {responseTime}
      </span>

      {/* Last checked — hidden on mobile */}
      <span className="hidden sm:block flex-shrink-0 w-24 text-right text-xs text-muted">
        {result?.checkedAt ? relativeTime(result.checkedAt) : '—'}
      </span>

      {/* Remove button — visible on hover */}
      <button
        type="button"
        onClick={() => onRemove(entry.id)}
        disabled={isProbing}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted hover:text-danger hover:bg-bg-overlay transition-all focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed"
        aria-label={`Remove ${entry.name}`}
        title={`Remove ${entry.name}`}
      >
        <TrashIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
