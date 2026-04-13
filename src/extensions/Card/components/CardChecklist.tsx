// CardChecklist — renders all named checklist groups + "Add checklist" button.
// Each group is a ChecklistSection. Optimistic mutations handled in parent container.
import { useMemo, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { ChecklistSection } from './ChecklistSection';
import type { Checklist } from '../api';
import Button from '../../../common/components/Button';

interface Props {
  checklists: Checklist[];
  boardMembers: Array<{ id: string; email: string; name: string | null; avatar_url?: string | null }>;
  onCreateChecklist: (title?: string) => Promise<void>;
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onItemAdd: (checklistId: string, title: string) => Promise<void>;
  onItemToggle: (checklistId: string, itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (checklistId: string, itemId: string, title: string) => Promise<void>;
  onItemDelete: (checklistId: string, itemId: string) => Promise<void>;
  onItemAssign: (checklistId: string, itemId: string, memberId: string | null) => Promise<void>;
  onItemDueDateChange: (checklistId: string, itemId: string, dueDate: string | null) => Promise<void>;
  onItemConvertToCard: (checklistId: string, itemId: string) => Promise<void>;
  onItemReorder: (checklistId: string, itemId: string, position: string) => Promise<void>;
  disabled?: boolean;
}

const CardChecklist = ({
  checklists,
  boardMembers,
  onCreateChecklist,
  onRenameChecklist,
  onDeleteChecklist,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  onItemAssign,
  onItemDueDateChange,
  onItemConvertToCard,
  onItemReorder,
  disabled,
}: Props) => {
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');

  const orderedChecklists = useMemo(() => {
    return [...checklists].sort((left, right) => {
      const leftCreated = left.created_at ? Date.parse(left.created_at) : Number.NaN;
      const rightCreated = right.created_at ? Date.parse(right.created_at) : Number.NaN;
      const leftHasCreated = Number.isFinite(leftCreated);
      const rightHasCreated = Number.isFinite(rightCreated);

      if (leftHasCreated && rightHasCreated && leftCreated !== rightCreated) {
        return leftCreated - rightCreated;
      }

      if (left.position === right.position) return 0;
      return left.position < right.position ? -1 : 1;
    });
  }, [checklists]);

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
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Checklists
        </h3>
        {!disabled && (
          <button
            type="button"
            className="flex items-center gap-1 rounded bg-bg-sunken px-2 py-0.5 text-xs text-base hover:bg-bg-sunken"
            onClick={() => {
              setAddingChecklist((v) => !v);
            }}
          >
            <PlusIcon className="h-3 w-3" />
            Add checklist
          </button>
        )}
      </div>

      {addingChecklist && (
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded border border-border bg-bg-overlay px-2 py-1 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Checklist title (optional)"
            value={newChecklistTitle}
            onChange={(e) => {
              setNewChecklistTitle(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateChecklist();
              if (e.key === 'Escape') { setAddingChecklist(false); setNewChecklistTitle(''); }
            }}
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => {
              void handleCreateChecklist();
            }}
          >
            Create
          </Button>
          <button
            type="button"
            className="text-sm text-muted hover:text-base"
            onClick={() => { setAddingChecklist(false); setNewChecklistTitle(''); }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-6">
        {orderedChecklists.map((cl) => (
          <ChecklistSection
            key={cl.id}
            checklist={cl}
            onRename={(title) => onRenameChecklist(cl.id, title)}
            onDelete={() => onDeleteChecklist(cl.id)}
            onItemAdd={(title) => onItemAdd(cl.id, title)}
            onItemToggle={(itemId, checked) => onItemToggle(cl.id, itemId, checked)}
            onItemRename={(itemId, title) => onItemRename(cl.id, itemId, title)}
            onItemDelete={(itemId) => onItemDelete(cl.id, itemId)}
            onItemAssign={(itemId, memberId) => onItemAssign(cl.id, itemId, memberId)}
            onItemDueDateChange={(itemId, dueDate) => onItemDueDateChange(cl.id, itemId, dueDate)}
            onItemConvertToCard={(itemId) => onItemConvertToCard(cl.id, itemId)}
            onItemReorder={(itemId, position) => onItemReorder(cl.id, itemId, position)}
            boardMembers={boardMembers}
            {...(disabled === undefined ? {} : { disabled })}
          />
        ))}
      </div>
    </section>
  );
};

export default CardChecklist;
