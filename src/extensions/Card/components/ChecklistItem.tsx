// ChecklistItem — single checklist row with toggle, rename, and delete.
import { useMemo, useState } from 'react';
import { marked } from 'marked';
import emojiData from '@emoji-mart/data';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import type { ChecklistItem as ChecklistItemType } from '../api';

marked.setOptions({ breaks: true, gfm: true });

const SHORTCODE_TO_NATIVE = (() => {
  const map = new Map<string, string>();
  const emojis = emojiData.emojis as Record<string, { skins?: Array<{ native?: string }> }>;
  const aliases = (emojiData.aliases ?? {}) as Record<string, string>;

  for (const [shortcode, value] of Object.entries(emojis)) {
    const native = value.skins?.[0]?.native;
    if (!native) continue;
    map.set(shortcode.toLowerCase(), native);
  }

  for (const [alias, canonical] of Object.entries(aliases)) {
    const native = emojis[canonical]?.skins?.[0]?.native;
    if (!native) continue;
    map.set(alias.toLowerCase(), native);
  }

  return map;
})();

function replaceEmojiShortcodes(text: string): string {
  return text.replaceAll(/:([a-z0-9_+-]+):/gi, (full, shortcode: string) => {
    return SHORTCODE_TO_NATIVE.get(shortcode.toLowerCase()) ?? full;
  });
}

function renderChecklistTitle(text: string): string {
  return marked.parseInline(replaceEmojiShortcodes(text)) as string;
}

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
  const renderedTitle = useMemo(() => renderChecklistTitle(item.title), [item.title]);

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
    <div className="flex min-w-0 items-start gap-2 py-1">
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
          className="min-w-0 flex-1 rounded border border-border bg-bg-overlay px-1 py-0.5 text-sm text-base focus:outline-none focus:ring-1 focus:ring-primary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setTitle(item.title); setEditing(false); } }}
          autoFocus
        />
      ) : (
        <button
          type="button"
          className={`min-w-0 flex-1 cursor-text whitespace-normal break-words bg-transparent p-0 text-left text-sm [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-2 ${item.checked ? 'text-muted line-through' : 'text-base'}`}
          onClick={() => !disabled && setEditing(true)}
          disabled={disabled}
          aria-label={`Edit: ${item.title}`}
          // [why] Render markdown + emoji shortcodes in checklist text for parity with comments.
          dangerouslySetInnerHTML={{ __html: renderedTitle }}
        />
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
