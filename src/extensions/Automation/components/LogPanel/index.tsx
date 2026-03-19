// LogPanel/index.tsx — Log tab content: board-wide RunLogTable.
// Fetches last 200 runs on mount; re-fetches when page changes.
// Subscribes to automation_ran WS event to prepend new rows in real time.
import { useEffect, useState, useCallback } from 'react';
import type { FC } from 'react';
import type { AutomationRunLog, PaginatedRunLogs, Automation } from '../../types';
import { getBoardRuns } from '../../api';
import { socket } from '~/extensions/Realtime/client/socket';
import RunLogTable from './RunLogTable';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  /** Automation list from the parent panel — used to resolve automation names for WS rows. */
  automations?: Automation[];
  onOpenCard?: ((cardId: string) => void) | undefined;
}

const LogPanel: FC<Props> = ({ boardId, automations = [], onOpenCard }) => {
  const [runsResult, setRunsResult] = useState<PaginatedRunLogs | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Real-time rows prepended when automation_ran fires while this tab is open.
  const [prependedRuns, setPrependedRuns] = useState<AutomationRunLog[]>([]);

  const fetchRuns = useCallback((targetPage: number) => {
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    getBoardRuns({ boardId, params: { page: targetPage, perPage: 50 } })
      .then((res) => { if (!cancelled) setRunsResult(res); })
      .catch(() => { if (!cancelled) setRunsError(translations['automation.runsPanel.error.loadFailed']); })
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
