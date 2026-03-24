// HealthCheckTab — main tab panel for the board Health Check feature.
// Renders: header (title, Refresh, Add buttons), row list, empty state,
// auto-refresh countdown, and the AddServiceModal.
// Sprint 116.

import { useEffect, useState, useCallback } from 'react';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  fetchHealthChecksThunk,
  removeHealthCheckThunk,
  probeAllThunk,
  selectHealthCheckEntries,
  selectHealthCheckStatus,
  selectHealthCheckLastCheckedAt,
} from './HealthCheckTab.duck';
import { HealthCheckRow } from '../../components/HealthCheckRow';
import { HealthCheckEmptyState } from '../../components/HealthCheckEmptyState';
import { HealthCheckCountdown } from '../../components/HealthCheckCountdown';
import { AddServiceModal } from '../../modals/AddServiceModal';
import { useHealthCheckAutoRefresh } from '../../hooks/useHealthCheckAutoRefresh';
import { useHealthCheckProbe } from '../../hooks/useHealthCheckProbe';
import { HEALTH_CHECK_POLL_INTERVAL_MS } from '../../config/healthCheckConfig';

const TOTAL_COUNTDOWN_SECONDS = Math.round(HEALTH_CHECK_POLL_INTERVAL_MS / 1000);

interface Props {
  boardId: string;
}

/** Formats an ISO timestamp as a human-readable "last checked" string. */
function formatLastChecked(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

/** Full Health Check tab panel: loads entries, renders rows, empty state, and countdown. */
export function HealthCheckTab({ boardId }: Props) {
  const dispatch = useAppDispatch();
  const entries = useAppSelector(selectHealthCheckEntries);
  const status = useAppSelector(selectHealthCheckStatus);
  const lastCheckedAt = useAppSelector(selectHealthCheckLastCheckedAt);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Per-row probe state (on-demand single probe).
  const { isProbing, probe } = useHealthCheckProbe({ boardId });

  // Fetch the list on mount (and when boardId changes).
  useEffect(() => {
    dispatch(fetchHealthChecksThunk({ boardId }));
  }, [dispatch, boardId]);

  // Probe-all on refresh (manual or auto).
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(probeAllThunk({ boardId }));
      await dispatch(fetchHealthChecksThunk({ boardId }));
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, boardId]);

  const { secondsUntilRefresh, triggerRefresh } = useHealthCheckAutoRefresh({
    onRefresh: handleRefresh,
  });

  const handleManualRefresh = useCallback(() => {
    triggerRefresh();
  }, [triggerRefresh]);

  const handleRemove = useCallback(
    (healthCheckId: string) => {
      dispatch(removeHealthCheckThunk({ boardId, healthCheckId }));
    },
    [dispatch, boardId],
  );

  const isEmpty = entries.length === 0;
  const isLoading = status === 'loading';

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header row */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Health Check</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Last checked:{' '}
            <span className="text-slate-300">{formatLastChecked(lastCheckedAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh countdown */}
          <HealthCheckCountdown
            secondsRemaining={secondsUntilRefresh}
            totalSeconds={TOTAL_COUNTDOWN_SECONDS}
          />

          {/* Manual refresh button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Refresh health checks"
            title="Refresh all services now"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>

          {/* Add service button */}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Add service to monitor"
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </div>
      </div>

      {/* Table header — only visible when there are entries */}
      {!isEmpty && (
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-slate-700/50 bg-slate-900/50">
          <div className="flex-shrink-0 w-5" aria-hidden="true" />
          <span className="flex-shrink-0 w-40 text-xs font-medium text-slate-500 uppercase tracking-wide">
            Name
          </span>
          <span className="flex-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
            URL
          </span>
          <span className="flex-shrink-0 w-24 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
            Response
          </span>
          <span className="flex-shrink-0 w-24 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
            Last checked
          </span>
          {/* spacer for remove button */}
          <div className="flex-shrink-0 w-7" aria-hidden="true" />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto" role="table" aria-label="Health check services">
        {isLoading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span
              className="h-6 w-6 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"
              aria-label="Loading health checks"
              role="status"
            />
          </div>
        ) : isEmpty ? (
          <HealthCheckEmptyState onAddService={() => setAddModalOpen(true)} />
        ) : (
          <div role="rowgroup">
            {entries.map((entry) => (
              <HealthCheckRow
                key={entry.id}
                entry={entry}
                isProbing={isProbing(entry.id)}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Service modal */}
      <AddServiceModal
        boardId={boardId}
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  );
}

export default HealthCheckTab;
