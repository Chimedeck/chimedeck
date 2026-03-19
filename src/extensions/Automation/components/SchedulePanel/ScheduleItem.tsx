// ScheduleItem — a single row for a SCHEDULED or DUE_DATE automation.
// Shows: icon, name, schedule summary, run-count chip, enable toggle, edit/delete actions.
import { useState, useEffect } from 'react';
import {
  ClockIcon,
  ExclamationCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { FC } from 'react';
import type { Automation } from '../../types';
import { scheduleSummary, dueDateSummary } from '../../utils/scheduleSummary';
import type { ScheduleConfig, DueDateConfig } from '../../utils/scheduleSummary';
import { updateAutomation, deleteAutomation } from '../../api';
import RunCountChip from '../LogPanel/RunCountChip';
import { socket } from '~/extensions/Realtime/client/socket';

interface Props {
  boardId: string;
  automation: Automation;
  onEdit: () => void;
  onDeleted: () => void;
  onToggled: () => void;
}

function getSummary(automation: Automation): string {
  if (automation.automationType === 'SCHEDULED') {
    const cfg = automation.trigger?.config as Partial<ScheduleConfig> | undefined;
    if (cfg?.scheduleType && cfg.hour !== undefined && cfg.minute !== undefined) {
      return scheduleSummary(cfg as ScheduleConfig);
    }
    return 'Scheduled';
  }
  if (automation.automationType === 'DUE_DATE') {
    const cfg = automation.trigger?.config as Partial<DueDateConfig> | undefined;
    if (cfg?.triggerMoment) {
      return dueDateSummary(cfg as DueDateConfig);
    }
    return 'Due date trigger';
  }
  return '';
}

const ScheduleItem: FC<Props> = ({ boardId, automation, onEdit, onDeleted, onToggled }) => {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Optimistic run-count delta incremented on automation_ran WS event.
  const [runDelta, setRunDelta] = useState(0);

  useEffect(() => {
    const unsubscribe = socket.subscribe({
      onEvent(event) {
        if (
          event.type === 'automation_ran' &&
          (event.payload as { automationId?: string } | undefined)?.automationId === automation.id
        ) {
          setRunDelta((d) => d + 1);
        }
      },
    });
    return unsubscribe;
  }, [automation.id]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await updateAutomation({
        boardId,
        automationId: automation.id,
        patch: { isEnabled: !automation.isEnabled },
      });
      onToggled();
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteAutomation({ boardId, automationId: automation.id });
      onDeleted();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const Icon = automation.automationType === 'DUE_DATE' ? ExclamationCircleIcon : ClockIcon;
  const summary = getSummary(automation);

  return (
    <li className="group flex items-start gap-3 rounded-md border border-slate-700 bg-slate-800 px-3 py-3">
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-200">{automation.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {summary} · {automation.actions.length} action{automation.actions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Run count chip — always visible */}
      <RunCountChip count={automation.runCount + runDelta} />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {/* Enable/disable toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          aria-label={automation.isEnabled ? 'Disable' : 'Enable'}
          title={automation.isEnabled ? 'Disable' : 'Enable'}
        >
          {automation.isEnabled ? (
            <CheckCircleIcon className="h-4 w-4 text-green-400" aria-hidden="true" />
          ) : (
            <XCircleIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Edit */}
        <button
          onClick={onEdit}
          className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          aria-label="Edit"
          title="Edit"
        >
          <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`rounded p-1 transition-colors disabled:opacity-50 ${
            confirmDelete
              ? 'bg-red-700 text-white hover:bg-red-600'
              : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
          }`}
          aria-label={confirmDelete ? 'Confirm delete' : 'Delete'}
          title={confirmDelete ? 'Click again to confirm' : 'Delete'}
        >
          <TrashIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

export default ScheduleItem;
