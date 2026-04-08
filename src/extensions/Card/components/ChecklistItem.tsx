// ChecklistItem — single checklist row with toggle, rename, and delete.
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import type { ChecklistItem as ChecklistItemType } from '../api';

interface Props {
  item: ChecklistItemType;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onRename: (itemId: string, title: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  disabled?: boolean;
}

export const ChecklistItem = ({ item, onToggle, onRename, onDelete, disabled }: Props) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  const submitRename = async () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      await onRename(item.id, trimmed);
    } else {
      setTitle(item.title);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-2 py-1">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-border-strong text-blue-500 bg-bg-surface"
        aria-label={`Toggle: ${item.title}`}
      />
      {editing ? (
        <input
          className="flex-1 rounded border border-border bg-bg-overlay px-1 py-0.5 text-sm text-base focus:outline-none focus:ring-1 focus:ring-primary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setTitle(item.title); setEditing(false); } }}
          autoFocus
        />
      ) : (
        <span
          className={`flex-1 cursor-text text-sm ${item.checked ? 'text-muted line-through' : 'text-base'}`}
          onClick={() => !disabled && setEditing(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
          aria-label={`Edit: ${item.title}`}
        >
          {item.title}
        </span>
      )}
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted hover:text-danger"
          onClick={() => onDelete(item.id)}
          aria-label={`Delete checklist item: ${item.title}`}
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
};
