// HealthCheckStatusDot — traffic-light circle with tooltip describing probe result.
// Pulse animation on green/amber indicates a live (recently-checked) status.
import { useState } from 'react';
import type { HealthCheckStatus } from '../api';

interface Props {
  status: HealthCheckStatus | null;
  httpStatus?: number | null | undefined;
  responseTimeMs?: number | null | undefined;
  errorMessage?: string | null | undefined;
}

const DOT_CLASSES: Record<NonNullable<HealthCheckStatus> | 'unknown', string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  unknown: 'bg-gray-300',
};

const PULSE_CLASSES: Record<NonNullable<HealthCheckStatus> | 'unknown', string> = {
  green: 'animate-ping bg-green-500',
  amber: 'animate-ping bg-amber-400',
  red: '',
  unknown: '',
};

function buildTooltip({
  status,
  httpStatus,
  responseTimeMs,
  errorMessage,
}: {
  status: HealthCheckStatus | null;
  httpStatus?: number | null | undefined;
  responseTimeMs?: number | null | undefined;
  errorMessage?: string | null | undefined;
}): string {
  if (!status || status === 'unknown') {
    return 'Not yet checked — click ↻ to probe';
  }
  if (status === 'red') {
    if (errorMessage?.toLowerCase().includes('timeout')) return 'Request timed out';
    if (errorMessage) return `Network error: ${errorMessage}`;
    if (httpStatus) return `${httpStatus} Error`;
    return 'Probe failed';
  }
  const time = responseTimeMs != null ? `${responseTimeMs} ms` : null;
  const code = httpStatus ? `${httpStatus} OK` : null;
  const slow = status === 'amber' && responseTimeMs != null ? ' (slow)' : '';
  const parts = [code, time ? `${time}${slow}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : status === 'amber' ? 'Slow response' : 'OK';
}

/** Presentational status dot with accessible tooltip. */
export function HealthCheckStatusDot({ status, httpStatus, responseTimeMs, errorMessage }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const resolved = (status ?? 'unknown') as NonNullable<HealthCheckStatus> | 'unknown';
  const tooltip = buildTooltip({ status, httpStatus, responseTimeMs, errorMessage });
  const hasPulse = resolved === 'green' || resolved === 'amber';

  return (
    <span
      className="relative inline-flex items-center justify-center h-5 w-5 flex-shrink-0"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="img"
      aria-label={tooltip}
    >
      {/* Pulse ring — visible for green/amber only */}
      {hasPulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-50 ${PULSE_CLASSES[resolved]}`}
          aria-hidden="true"
        />
      )}
      {/* Core dot */}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${DOT_CLASSES[resolved]}`} />

      {/* Tooltip */}
      {showTooltip && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg pointer-events-none"
        >
          {tooltip}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
