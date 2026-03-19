// ButtonsTab — Automation panel "Buttons" tab content.
// Two sections: Card Buttons and Board Buttons, each listing automations with edit/delete.
import { useState, useEffect } from 'react';
import {
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { ButtonIcon } from '../shared/IconPicker';
import type { FC } from 'react';
import type { Automation } from '../../types';
import { updateAutomation, deleteAutomation } from '../../api';
import CardButtonBuilder from '../CardButtons/CardButtonBuilder';
import BoardButtonBuilder from '../BoardButtons/BoardButtonBuilder';
import RunCountChip from '../LogPanel/RunCountChip';
import { socket } from '~/extensions/Realtime/client/socket';

interface Props {
  boardId: string;
  automations: Automation[];
  onChanged: () => void;
}

interface ButtonRowProps {
  boardId: string;
  automation: Automation;
  onEdited: () => void;
  onDeleted: () => void;
}

const ButtonRow: FC<ButtonRowProps> = ({ boardId, automation, onEdited, onDeleted }) => {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
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
      onEdited();
    } catch {
      // TODO: show error toast
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
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-800/50 rounded-md group">
        {/* Icon */}
        <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded bg-slate-800 border border-slate-700">
          <ButtonIcon name={automation.icon} className="h-3.5 w-3.5 text-slate-400" />
        </span>

        {/* Name */}
        <span className="flex-1 text-sm text-slate-200 truncate">{automation.name}</span>

        {/* Action count chip */}
        <span className="text-xs text-slate-500 flex-shrink-0">
          {automation.actions.length} action{automation.actions.length !== 1 ? 's' : ''}
        </span>

        {/* Run count chip */}
        <RunCountChip count={automation.runCount + runDelta} />

        {/* Enable toggle */}
        <button
          type="button"
          disabled={toggling}
          onClick={handleToggle}
          className="flex-shrink-0 rounded p-1 text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
          aria-label={automation.isEnabled ? 'Disable button' : 'Enable button'}
          title={automation.isEnabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
        >
          {automation.isEnabled ? (
            <CheckCircleIcon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <XCircleIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Edit */}
        <button
          type="button"
          onClick={() => setShowBuilder(true)}
          className="flex-shrink-0 rounded p-1 text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Edit button"
        >
          <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Delete / Confirm */}
        {confirmDelete ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="text-xs rounded px-2 py-0.5 bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {deleting ? '…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs rounded px-2 py-0.5 text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex-shrink-0 rounded p-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Delete button"
          >
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Edit builder modal */}
      {showBuilder && automation.automationType === 'CARD_BUTTON' && (
        <CardButtonBuilder
          boardId={boardId}
          existing={automation}
          onSave={() => {
            setShowBuilder(false);
            onEdited();
          }}
          onClose={() => setShowBuilder(false)}
        />
      )}
      {showBuilder && automation.automationType === 'BOARD_BUTTON' && (
        <BoardButtonBuilder
          boardId={boardId}
          existing={automation}
          onSave={() => {
            setShowBuilder(false);
            onEdited();
          }}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </>
  );
};

const ButtonsTab: FC<Props> = ({ boardId, automations, onChanged }) => {
  const [showCardBuilder, setShowCardBuilder] = useState(false);
  const [showBoardBuilder, setShowBoardBuilder] = useState(false);

  const cardButtons = automations.filter((a) => a.automationType === 'CARD_BUTTON');
  const boardButtons = automations.filter((a) => a.automationType === 'BOARD_BUTTON');

  return (
    <div className="flex flex-col gap-5 py-4">
      {/* ── Card Buttons section ── */}
      <section>
        <div className="flex items-center justify-between px-4 mb-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Card Buttons
          </h3>
          <button
            type="button"
            onClick={() => setShowCardBuilder(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-400 hover:bg-slate-800 hover:text-blue-300 transition-colors"
            aria-label="Create card button"
          >
            <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </button>
        </div>

        {cardButtons.length === 0 ? (
          <p className="px-4 text-xs text-slate-500">No card buttons yet. Add one to appear on every card's back panel.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {cardButtons.map((a) => (
              <ButtonRow
                key={a.id}
                boardId={boardId}
                automation={a}
                onEdited={onChanged}
                onDeleted={onChanged}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Board Buttons section ── */}
      <section>
        <div className="flex items-center justify-between px-4 mb-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Board Buttons
          </h3>
          <button
            type="button"
            onClick={() => setShowBoardBuilder(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-400 hover:bg-slate-800 hover:text-blue-300 transition-colors"
            aria-label="Create board button"
          >
            <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </button>
        </div>

        {boardButtons.length === 0 ? (
          <p className="px-4 text-xs text-slate-500">No board buttons yet. Add one to appear in the board header.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {boardButtons.map((a) => (
              <ButtonRow
                key={a.id}
                boardId={boardId}
                automation={a}
                onEdited={onChanged}
                onDeleted={onChanged}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      {showCardBuilder && (
        <CardButtonBuilder
          boardId={boardId}
          onSave={() => {
            setShowCardBuilder(false);
            onChanged();
          }}
          onClose={() => setShowCardBuilder(false)}
        />
      )}
      {showBoardBuilder && (
        <BoardButtonBuilder
          boardId={boardId}
          onSave={() => {
            setShowBoardBuilder(false);
            onChanged();
          }}
          onClose={() => setShowBoardBuilder(false)}
        />
      )}
    </div>
  );
};

export default ButtonsTab;
