// LogPanel/index.tsx — Log tab content: QuotaBar + board-wide RunLogTable.
// Fetches quota and last 200 runs on mount; re-fetches when page changes.
import { useEffect, useState } from 'react';
import type { FC } from 'react';
import type { AutomationQuota, PaginatedRunLogs } from '../../types';
import { getBoardRuns, getAutomationQuota } from '../../api';
import QuotaBar from './QuotaBar';
import RunLogTable from './RunLogTable';

interface Props {
  boardId: string;
  onOpenCard?: ((cardId: string) => void) | undefined;
}

const LogPanel: FC<Props> = ({ boardId, onOpenCard }) => {
  const [quota, setQuota] = useState<AutomationQuota | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const [runsResult, setRunsResult] = useState<PaginatedRunLogs | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Fetch quota once on mount
  useEffect(() => {
    let cancelled = false;
    getAutomationQuota({ boardId })
      .then((res) => { if (!cancelled) setQuota(res.data); })
      .catch(() => { if (!cancelled) setQuotaError('Could not load quota.'); });
    return () => { cancelled = true; };
  }, [boardId]);

  // Fetch board-wide runs on mount and on page change
  useEffect(() => {
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    getBoardRuns({ boardId, params: { page, perPage: 50 } })
      .then((res) => { if (!cancelled) setRunsResult(res); })
      .catch(() => { if (!cancelled) setRunsError('Failed to load run history.'); })
      .finally(() => { if (!cancelled) setRunsLoading(false); });
    return () => { cancelled = true; };
  }, [boardId, page]);

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
        onPageChange={setPage}
        {...(onOpenCard ? { onOpenCard } : {})}
      />
    </div>
  );
};

export default LogPanel;
