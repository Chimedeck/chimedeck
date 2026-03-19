// AutomationRunsPanel — per-automation run history, opened from the Rules/Buttons/Schedule edit view.
// Shows a paginated run log scoped to one automation (GET /:automationId/runs).
import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { AutomationRunLog, PaginatedRunLogs } from '../../types';
import { getAutomationRuns } from '../../api';
import RunLogTable from './RunLogTable';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  automationId: string;
  automationName: string;
  onBack: () => void;
  onOpenCard?: ((cardId: string) => void) | undefined;
}

const AutomationRunsPanel: FC<Props> = ({
  boardId,
  automationId,
  automationName,
  onBack,
  onOpenCard,
}) => {
  const [result, setResult] = useState<PaginatedRunLogs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAutomationRuns({ boardId, automationId, params: { page, perPage: 20 } })
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch(() => {
        if (!cancelled) setError(translations['automation.runsPanel.error.loadFailed']);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [boardId, automationId, page]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 shrink-0">
        <button
          className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          onClick={onBack}
          aria-label={translations['automation.runsPanel.backAriaLabel']}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-sm text-slate-200 font-medium truncate">{automationName}</span>
        <span className="ml-auto text-xs text-slate-500">{translations['automation.runsPanel.runHistory']}</span>
      </div>

      <RunLogTable
        result={result}
        loading={loading}
        error={error}
        page={page}
        onPageChange={setPage}
        {...(onOpenCard ? { onOpenCard } : {})}
      />
    </div>
  );
};

export default AutomationRunsPanel;
