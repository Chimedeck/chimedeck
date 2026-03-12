// LogPanel/index.tsx — Log tab content: QuotaBar + board-wide RunLogTable.
// Fetches quota and last 200 runs on mount; re-fetches when page changes.
// Subscribes to automation_ran WS event to prepend new rows in real time.
import { useEffect, useState, useCallback } from 'react';
import type { FC } from 'react';
import type { AutomationQuota, AutomationRunLog, PaginatedRunLogs, Automation } from '../../types';
import { getBoardRuns, getAutomationQuota } from '../../api';
import { socket } from '~/extensions/Realtime/client/socket';
import QuotaBar from './QuotaBar';
import RunLogTable from './RunLogTable';

interface Props {
  boardId: string;
  /** Automation list from the parent panel — used to resolve automation names for WS rows. */
  automations?: Automation[];
  onOpenCard?: ((cardId: string) => void) | undefined;
}

const LogPanel: FC<Props> = ({ boardId, automations = [], onOpenCard }) => {
  const [quota, setQuota] = useState<AutomationQuota | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const [runsResult, setRunsResult] = useState<PaginatedRunLogs | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Real-time rows prepended when automation_ran fires while this tab is open.
  const [prependedRuns, setPrependedRuns] = useState<AutomationRunLog[]>([]);

  // Fetch quota once on mount
  useEffect(() => {
    let cancelled = false;
    getAutomationQuota({ boardId })
      .then((res) => { if (!cancelled) setQuota(res.data); })
      .catch(() => { if (!cancelled) setQuotaError('Could not load quota.'); });
    return () => { cancelled = true; };
  }, [boardId]);

  const fetchRuns = useCallback((targetPage: number) => {
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    getBoardRuns({ boardId, params: { page: targetPage, perPage: 50 } })
      .then((res) => { if (!cancelled) setRunsResult(res); })
      .catch(() => { if (!cancelled) setRunsError('Failed to load run history.'); })
      .finally(() => { if (!cancelled) setRunsLoading(false); });
    return () => { cancelled = true; };
  }, [boardId]);

  // Fetch board-wide runs on mount and on page change
  useEffect(() => {
    const cancel = fetchRuns(page);
    // Clear prepended rows when navigating pages so there are no duplicates.
    if (page !== 1) setPrependedRuns([]);
    return cancel;
  }, [boardId, page, fetchRuns]);

  // Subscribe to automation_ran WS events and prepend synthetic rows.
  useEffect(() => {
    const unsubscribe = socket.subscribe({
      onEvent(event) {
        if (event.type !== 'automation_ran') return;
        const p = event.payload as {
          automationId: string;
          runLogId: string;
          status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
          ranAt: string;
        } | undefined;
        if (!p) return;

        // Resolve automation name from the prop list if available.
        const matched = automations.find((a) => a.id === p.automationId);

        const newRow: AutomationRunLog = {
          id: p.runLogId,
          automationId: p.automationId,
          automationName: matched?.name ?? p.automationId,
          // Only set automationType when defined — exactOptionalPropertyTypes forbids assigning undefined.
          ...(matched?.automationType !== undefined ? { automationType: matched.automationType } : {}),
          status: p.status,
          ranAt: p.ranAt,
          context: {},
        };

        // Only prepend on page 1 to avoid showing a row that belongs to a different page.
        setPrependedRuns((prev) => {
          // Deduplicate: skip if we already have this runLogId.
          if (prev.some((r) => r.id === p.runLogId)) return prev;
          return [newRow, ...prev];
        });
      },
    });
    return unsubscribe;
  }, [automations]);

  return (
    <div className="flex flex-col h-full">
      {quota && <QuotaBar quota={quota} />}
      {quotaError && (
        <p className="px-4 py-2 text-xs text-red-400">{quotaError}</p>
      )}

      <RunLogTable
        result={runsResult}
        loading={runsLoading}
        error={runsError}
        page={page}
        onPageChange={(p) => { setPage(p); setPrependedRuns([]); }}
        prependedRuns={page === 1 ? prependedRuns : []}
        {...(onOpenCard ? { onOpenCard } : {})}
      />
    </div>
  );
};

export default LogPanel;
