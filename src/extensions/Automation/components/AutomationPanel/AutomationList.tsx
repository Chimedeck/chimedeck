// AutomationList — renders the list of RULE automations with enable toggle + edit/delete actions.
import { useState, useEffect } from 'react';
import {
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import type { Automation } from '../../types';
import { updateAutomation, deleteAutomation } from '../../api';
import Button from '../../../../common/components/Button';
import RunCountChip from '../LogPanel/RunCountChip';
import { socket } from '~/extensions/Realtime/client/socket';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  automations: Automation[];
  onCreateRule: () => void;
  onEditRule: (automation: Automation) => void;
  onChanged: () => void;
}

interface RowProps {
  boardId: string;
  automation: Automation;
  onEdit: () => void;
  onDeleted: () => void;
  onToggled: () => void;
}

const AutomationRow = ({ boardId, automation, onEdit, onDeleted, onToggled }: RowProps) => {
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

  const triggerLabel = automation.trigger?.triggerType
    ? automation.trigger.triggerType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : translations['automation.list.noTrigger'];

  return (
    <li className="group flex items-start gap-3 rounded-md border border-border bg-bg-surface px-3 py-3">
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <BoltIcon className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-subtle">{automation.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {triggerLabel} · {automation.actions.length} {automation.actions.length !== 1 ? translations['automation.list.actions'] : translations['automation.list.action']}
        </p>
      </div>

      {/* Run count chip */}
      <RunCountChip count={automation.runCount + runDelta} />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Enable/disable toggle */}
        <button
          className={`rounded p-1 transition-colors ${
            toggling ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-overlay'
          } ${automation.isEnabled ? 'text-emerald-400' : 'text-muted'}`}
          onClick={handleToggle}
          disabled={toggling}
          aria-label={automation.isEnabled ? translations['automation.list.row.disableAriaLabel'] : translations['automation.list.row.enableAriaLabel']}
          title={automation.isEnabled ? translations['automation.list.row.disableTitle'] : translations['automation.list.row.enableTitle']}
        >
          {automation.isEnabled ? (
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <XCircleIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Edit */}
        <button
          className="rounded p-1 text-muted hover:bg-bg-overlay hover:text-subtle transition-colors"
          onClick={onEdit}
          aria-label={translations['automation.list.row.editAriaLabel']}
          title={translations['automation.list.row.editTitle']}
        >
          <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Delete */}
        <button
          className={`rounded p-1 transition-colors ${
            confirmDelete
              ? 'bg-red-700 text-white hover:bg-red-600'
              : 'text-muted hover:bg-bg-overlay hover:text-red-400'
          } ${deleting ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleDelete}
          disabled={deleting}
          aria-label={confirmDelete ? translations['automation.list.row.confirmDeleteAriaLabel'] : translations['automation.list.row.deleteAriaLabel']}
          title={confirmDelete ? translations['automation.list.row.confirmDeleteTitle'] : translations['automation.list.row.deleteTitle']}
          onBlur={() => setConfirmDelete(false)}
        >
          <TrashIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

const AutomationList = ({ boardId, automations, onCreateRule, onEditRule, onChanged }: Props) => {
  const rules = automations.filter((a) => a.automationType === 'RULE');

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {translations['automation.list.sectionLabel']} ({rules.length})
        </p>
        <Button
          variant="primary"
          onClick={onCreateRule}
          className="flex items-center gap-1"
        >
          {translations['automation.list.createRule']}
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {rules.map((automation) => (
          <AutomationRow
            key={automation.id}
            boardId={boardId}
            automation={automation}
            onEdit={() => onEditRule(automation)}
            onDeleted={onChanged}
            onToggled={onChanged}
          />
        ))}
      </ul>
    </div>
  );
};

export default AutomationList;
