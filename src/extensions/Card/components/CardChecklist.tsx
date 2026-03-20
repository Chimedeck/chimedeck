// CardChecklist — renders all named checklist groups + "Add checklist" button.
// Each group is a ChecklistSection. Optimistic mutations handled in parent container.
import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { ChecklistSection } from './ChecklistSection';
import type { Checklist } from '../api';

interface Props {
  checklists: Checklist[];
  onCreateChecklist: (title?: string) => Promise<void>;
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onItemAdd: (checklistId: string, title: string) => Promise<void>;
  onItemToggle: (checklistId: string, itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (checklistId: string, itemId: string, title: string) => Promise<void>;
  onItemDelete: (checklistId: string, itemId: string) => Promise<void>;
  disabled?: boolean;
}

const CardChecklist = ({
  checklists,
  onCreateChecklist,
  onRenameChecklist,
  onDeleteChecklist,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  disabled,
}: Props) => {
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');

  const handleCreateChecklist = async () => {
    const trimmed = newChecklistTitle.trim() || undefined;
    setAddingChecklist(false);
    setNewChecklistTitle('');
    await onCreateChecklist(trimmed);
  };

  if (checklists.length === 0 && disabled) return null;

  return (
    <section aria-label="Checklists">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
          Checklists
        </h3>
        {!disabled && (
          <button
            type="button"
            className="flex items-center gap-1 rounded bg-gray-200 dark:bg-slate-700 px-2 py-0.5 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600"
            onClick={() => setAddingChecklist((v) => !v)}
          >
            <PlusIcon className="h-3 w-3" />
            Add checklist
          </button>
        )}
      </div>

      {addingChecklist && (
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded border border-gray-300 dark:border-slate-600 px-2 py-1 text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800 focus:border-blue-400 focus:outline-none"
            placeholder="Checklist title (optional)"
            value={newChecklistTitle}
            onChange={(e) => setNewChecklistTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateChecklist();
              if (e.key === 'Escape') { setAddingChecklist(false); setNewChecklistTitle(''); }
            }}
            autoFocus
          />
          <button
            type="button"
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
            onClick={handleCreateChecklist}
          >
            Create
          </button>
          <button
            type="button"
            className="text-sm text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
            onClick={() => { setAddingChecklist(false); setNewChecklistTitle(''); }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-6">
        {checklists.map((cl) => (
          <ChecklistSection
            key={cl.id}
            checklist={cl}
            onRename={(title) => onRenameChecklist(cl.id, title)}
            onDelete={() => onDeleteChecklist(cl.id)}
            onItemAdd={(title) => onItemAdd(cl.id, title)}
            onItemToggle={(itemId, checked) => onItemToggle(cl.id, itemId, checked)}
            onItemRename={(itemId, title) => onItemRename(cl.id, itemId, title)}
            onItemDelete={(itemId) => onItemDelete(cl.id, itemId)}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
};

export default CardChecklist;
