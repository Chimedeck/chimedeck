// ChecklistSection — a single named checklist group: editable title, progress, items, add form, delete.
import { useState, useRef, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import type { Checklist, ChecklistItem as ChecklistItemType } from '../api';
import { ChecklistItem } from './ChecklistItem';
import { ChecklistProgress } from './ChecklistProgress';

interface Props {
  checklist: Checklist;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onItemAdd: (title: string) => Promise<void>;
  onItemToggle: (itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (itemId: string, title: string) => Promise<void>;
  onItemDelete: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

export const ChecklistSection = ({
  checklist,
  onRename,
  onDelete,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  disabled,
}: Props) => {
  const { items } = checklist;
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(checklist.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Keep titleDraft in sync when the prop changes (e.g. after server confirmation)
  useEffect(() => { setTitleDraft(checklist.title); }, [checklist.title]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  const handleTitleCommit = async () => {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === checklist.title) return;
    await onRename(trimmed);
  };

  const handleItemAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await onItemAdd(trimmed);
    setNewTitle('');
    setAdding(false);
  };

  const checked = items.filter((i: ChecklistItemType) => i.checked).length;

  return (
    <section aria-label={`Checklist: ${checklist.title}`} className="space-y-1">
      {/* Title row */}
      <div className="flex items-center justify-between gap-2 mb-1">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className="flex-1 rounded border border-blue-400 px-2 py-0.5 text-sm font-semibold text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleCommit();
              if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(checklist.title); }
            }}
          />
        ) : (
          <button
            type="button"
            className="flex-1 text-left text-sm font-semibold text-gray-800 dark:text-slate-200 hover:text-blue-500 dark:hover:text-blue-400 transition-colors truncate"
            onClick={() => !disabled && setEditingTitle(true)}
            title="Click to rename"
            disabled={disabled}
          >
            {checklist.title}
          </button>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {!disabled && (
            <>
              <button
                type="button"
                className="rounded bg-gray-200 dark:bg-slate-700 px-2 py-0.5 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600"
                onClick={() => setAdding((v) => !v)}
              >
                + Item
              </button>
              <button
                type="button"
                className="rounded p-1 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={onDelete}
                title="Delete checklist"
                aria-label="Delete checklist"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {items.length > 0 && <ChecklistProgress total={items.length} checked={checked} />}

      <div className="mt-1 space-y-0.5">
        {items.map((item: ChecklistItemType) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={onItemToggle}
            onRename={onItemRename}
            onDelete={onItemDelete}
            disabled={disabled}
          />
        ))}
      </div>

      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded border border-gray-300 dark:border-slate-600 px-2 py-1 text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800 focus:border-blue-400 focus:outline-none"
            placeholder="Add an item…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleItemAdd();
              if (e.key === 'Escape') setAdding(false);
            }}
            autoFocus
          />
          <button
            type="button"
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            onClick={handleItemAdd}
            disabled={!newTitle.trim()}
          >
            Add
          </button>
          <button
            type="button"
            className="text-sm text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
            onClick={() => setAdding(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
};
