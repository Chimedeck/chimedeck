// ChecklistSection — full checklist widget: progress bar + items + add form.
import { useState } from 'react';
import type { ChecklistItem as ChecklistItemType } from '../api';
import { ChecklistItem } from './ChecklistItem';
import { ChecklistProgress } from './ChecklistProgress';

interface Props {
  items: ChecklistItemType[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onRename: (itemId: string, title: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

export const ChecklistSection = ({ items, onAdd, onToggle, onRename, onDelete, disabled }: Props) => {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setNewTitle('');
    setAdding(false);
  };

  const checked = items.filter((i) => i.checked).length;

  return (
    <section aria-label="Checklist">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Checklist</h3>
        {!disabled && (
          <button
            type="button"
            className="rounded bg-gray-200 dark:bg-slate-700 px-2 py-0.5 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600"
            onClick={() => setAdding((v) => !v)}
          >
            + Add item
          </button>
        )}
      </div>
      {items.length > 0 && <ChecklistProgress total={items.length} checked={checked} />}
      <div className="mt-1 space-y-0.5">
        {items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onToggle={onToggle}
            onRename={onRename}
            onDelete={onDelete}
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
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            autoFocus
          />
          <button
            type="button"
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            onClick={handleAdd}
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
