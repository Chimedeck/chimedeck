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
import Button from '../../../../common/components/Button';
import Spinner from '../../../../common/components/Spinner';

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
    <div className="flex flex-col flex-1 overflow-hidden bg-bg-base">
      {/* Header row */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-base">Health Check</h2>
          <p className="text-xs text-muted mt-0.5">
            Last checked:{' '}
            <span className="text-subtle">{formatLastChecked(lastCheckedAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh countdown */}
          <HealthCheckCountdown
            secondsRemaining={secondsUntilRefresh}
            totalSeconds={TOTAL_COUNTDOWN_SECONDS}
          />

          {/* Manual refresh button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Refresh health checks"
            title="Refresh all services now"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </Button>

          {/* Add service button */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5"
            aria-label="Add service to monitor"
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>

      {/* Table header — only visible when there are entries */}
      {!isEmpty && (
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-bg-base/50">
          <div className="flex-shrink-0 w-5" aria-hidden="true" />
          <span className="flex-shrink-0 w-40 text-xs font-medium text-muted uppercase tracking-wide">
            Name
          </span>
          <span className="flex-1 text-xs font-medium text-muted uppercase tracking-wide">
            URL
          </span>
          <span className="flex-shrink-0 w-24 text-right text-xs font-medium text-muted uppercase tracking-wide">
            Response
          </span>
          <span className="flex-shrink-0 w-24 text-right text-xs font-medium text-muted uppercase tracking-wide">
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
            <Spinner className="h-6 w-6" />
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
