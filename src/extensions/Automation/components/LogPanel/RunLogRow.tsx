// RunLogRow — a single row in the run log table.
// Expandable to show context + error via RunLogDetail.
import { useState } from 'react';
import type { FC } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  BoltIcon,
  PlayIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import type { AutomationRunLog } from '../../types';
import RunLogDetail from './RunLogDetail';

interface Props {
  run: AutomationRunLog;
  onOpenCard?: ((cardId: string) => void) | undefined;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_ICON: Record<string, { icon: typeof CheckCircleIcon; cls: string; label: string }> = {
  SUCCESS: { icon: CheckCircleIcon, cls: 'text-emerald-400', label: 'Success' },
  PARTIAL: { icon: ExclamationCircleIcon, cls: 'text-amber-400', label: 'Partial' },
  FAILED: { icon: XCircleIcon, cls: 'text-red-400', label: 'Failed' },
};

const TYPE_ICON: Record<string, { icon: typeof BoltIcon; label: string }> = {
  RULE: { icon: BoltIcon, label: 'Rule' },
  CARD_BUTTON: { icon: PlayIcon, label: 'Card button' },
  BOARD_BUTTON: { icon: PlayIcon, label: 'Board button' },
  SCHEDULED: { icon: ClockIcon, label: 'Schedule' },
  DUE_DATE: { icon: ClockIcon, label: 'Due date' },
};

const RunLogRow: FC<Props> = ({ run, onOpenCard }) => {
  const [expanded, setExpanded] = useState(false);

  const statusMeta = STATUS_ICON[run.status] ?? STATUS_ICON['FAILED']!;
  const StatusIcon = statusMeta.icon;

  const typeMeta = TYPE_ICON[run.automationType ?? ''] ?? TYPE_ICON['RULE']!;
  const TypeIcon = typeMeta.icon;

  return (
    <>
      <tr
        className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
        data-testid="run-log-row"
      >
        {/* Status */}
        <td className="py-2 pl-4 pr-2 w-8">
          <StatusIcon
            className={`h-4 w-4 ${statusMeta.cls}`}
            aria-label={statusMeta.label}
          />
        </td>

        {/* Automation name + type chip */}
        <td className="py-2 px-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-xs text-slate-200">{run.automationName}</span>
            <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
              <TypeIcon className="h-3 w-3" aria-hidden="true" />
              {typeMeta.label}
            </span>
          </div>
        </td>

        {/* Card link */}
        <td className="py-2 px-2 min-w-0">
          {run.cardId && run.cardName ? (
            <button
              className="truncate text-xs text-blue-400 hover:underline text-left max-w-[120px]"
              onClick={() => onOpenCard?.(run.cardId!)}
              title={run.cardName}
            >
              {run.cardName}
            </button>
          ) : (
            <span className="text-xs text-slate-500">Board-wide</span>
          )}
        </td>

        {/* Triggered by */}
        <td className="py-2 px-2">
          <span className="text-xs text-slate-400">
            {run.triggeredByUser ? run.triggeredByUser.name : 'Scheduled'}
          </span>
        </td>

        {/* When */}
        <td className="py-2 px-2 whitespace-nowrap">
          <span className="text-xs text-slate-500" title={run.ranAt}>
            {relativeTime(run.ranAt)}
          </span>
        </td>

        {/* Expand toggle */}
        <td className="py-2 pl-2 pr-4 w-8">
          <button
            className="rounded p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>
        </td>
      </tr>

      {expanded && <RunLogDetail run={run} />}
    </>
  );
};

export default RunLogRow;
