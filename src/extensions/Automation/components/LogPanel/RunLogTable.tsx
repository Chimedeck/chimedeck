// RunLogTable — paginated table of automation run logs.
// Columns: Status | Automation (name + type chip) | Card | Triggered by | When | Details
import { useState } from 'react';
import type { FC } from 'react';
import type { AutomationRunLog, PaginatedRunLogs } from '../../types';
import RunLogRow from './RunLogRow';
import translations from '../../translations/en.json';

interface Props {
  result: PaginatedRunLogs | null;
  loading: boolean;
  error: string | null;
  page: number;
  onPageChange: (page: number) => void;
  onOpenCard?: ((cardId: string) => void) | undefined;
  // Allows callers to prepend real-time rows from WS events
  prependedRuns?: AutomationRunLog[];
}

const COLUMN_HEADERS = [
  { key: 'status', label: '', className: 'w-8 pl-4 pr-2' },
  { key: 'automation', label: translations['automation.runLogTable.col.automation'], className: 'px-2' },
  { key: 'card', label: translations['automation.runLogTable.col.card'], className: 'px-2' },
  { key: 'triggeredBy', label: translations['automation.runLogTable.col.triggeredBy'], className: 'px-2' },
  { key: 'when', label: translations['automation.runLogTable.col.when'], className: 'px-2' },
  { key: 'expand', label: '', className: 'w-8 pl-2 pr-4' },
];

const RunLogTable: FC<Props> = ({
  result,
  loading,
  error,
  page,
  onPageChange,
  onOpenCard,
  prependedRuns = [],
}) => {
  const rows: AutomationRunLog[] = [
    ...prependedRuns,
    ...(result?.data ?? []),
  ];
  const totalPage = result?.metadata?.totalPage ?? 1;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700">
              {COLUMN_HEADERS.map((col) => (
                <th
                  key={col.key}
                  className={`py-2 text-[10px] uppercase tracking-wide text-slate-500 font-semibold ${col.className}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  {translations['automation.runLogTable.loading']}
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-red-400">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                  {translations['automation.runLogTable.empty']}
                </td>
              </tr>
            )}
            {!loading && !error && rows.map((run) => (
              <RunLogRow key={run.id} run={run} {...(onOpenCard ? { onOpenCard } : {})} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPage > 1 && (
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-slate-700 shrink-0">
          <button
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={translations['automation.runLogTable.prevAriaLabel']}
          >
            {translations['automation.runLogTable.prev']}
          </button>
          <span className="text-xs text-slate-500">
            {page} / {totalPage}
          </span>
          <button
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
            disabled={page >= totalPage}
            onClick={() => onPageChange(page + 1)}
            aria-label={translations['automation.runLogTable.nextAriaLabel']}
          >
            {translations['automation.runLogTable.next']}
          </button>
        </div>
      )}
    </div>
  );
};

export default RunLogTable;
