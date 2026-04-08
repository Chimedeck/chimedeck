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
import translations from '../../translations/en.json';

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
    <li className="group flex items-start gap-3 rounded-md border border-border bg-bg-surface px-3 py-3">
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-subtle">{automation.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {summary} · {automation.actions.length} {automation.actions.length !== 1 ? translations['automation.scheduleItem.actions'] : translations['automation.scheduleItem.action']}
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
          className="rounded p-1 text-muted hover:text-subtle hover:bg-bg-overlay transition-colors disabled:opacity-50"
          aria-label={automation.isEnabled ? translations['automation.scheduleItem.disableAriaLabel'] : translations['automation.scheduleItem.enableAriaLabel']}
          title={automation.isEnabled ? translations['automation.scheduleItem.disableAriaLabel'] : translations['automation.scheduleItem.enableAriaLabel']}
        >
          {automation.isEnabled ? (
            <CheckCircleIcon className="h-4 w-4 text-success" aria-hidden="true" />
          ) : (
            <XCircleIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Edit */}
        <button
          onClick={onEdit}
          className="rounded p-1 text-muted hover:text-subtle hover:bg-bg-overlay transition-colors"
          aria-label={translations['automation.scheduleItem.editAriaLabel']}
          title={translations['automation.scheduleItem.editAriaLabel']}
        >
          <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`rounded p-1 transition-colors disabled:opacity-50 ${
            confirmDelete
              ? 'bg-red-700 text-white hover:bg-red-600'  // [theme-exception]
              : 'text-muted hover:text-danger hover:bg-bg-overlay'
          }`}
          aria-label={confirmDelete ? translations['automation.scheduleItem.confirmDeleteAriaLabel'] : translations['automation.scheduleItem.deleteAriaLabel']}
          title={confirmDelete ? translations['automation.scheduleItem.confirmDeleteTitle'] : translations['automation.scheduleItem.deleteTitle']}
        >
          <TrashIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

export default ScheduleItem;
