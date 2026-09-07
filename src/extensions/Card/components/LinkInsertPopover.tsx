// Popover for inserting or editing a hyperlink in the Tiptap editor.
// Shows a small floating panel with URL + optional display text fields.
// Matches the design in the mockup: dark-themed panel, Link* + Display text fields,
// Cancel / Insert buttons.
import { useRef, useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { getMarkRange } from '@tiptap/core';
import Button from '../../../common/components/Button';
import { fetchLinkPreview } from '~/extensions/Attachments/api';
import { getInlineTitleFromUrl, normalizeHttpUrlInput } from '~/common/utils/urlDisplayText';

const LINK_CLASS_BUTTON = 'cd-link-button';

interface Props {
  editor: Editor | null;
  onClose: () => void;
}

function getSelectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  if (from !== to) return editor.state.doc.textBetween(from, to, ' ');

  if (!editor.isActive('link')) return '';
  const linkType = editor.state.schema.marks.link;
  const range = getMarkRange(editor.state.selection.$from, linkType);
  if (!range) return '';
  return editor.state.doc.textBetween(range.from, range.to, ' ');
}

function getActiveLinkHref(editor: Editor): string {
  if (!editor.isActive('link')) return '';
  return (editor.getAttributes('link')['href'] as string | undefined) ?? '';
}

async function resolveInlineLabel(href: string): Promise<string> {
  const fallback = getInlineTitleFromUrl(href);
  try {
    const preview = await fetchLinkPreview({ url: href });
    const title = preview.data.title.trim();
    return title || fallback;
  } catch {
    return fallback;
  }
}

const LinkInsertPopover = ({ editor, onClose }: Props) => {
  const [url, setUrl] = useState(() => (editor ? getActiveLinkHref(editor) : ''));
  const [displayText, setDisplayText] = useState(() =>
    editor ? getSelectionText(editor) : '',
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus URL input on open
  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer so the same mousedown that opened us doesn't immediately close us
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const handleInsert = useCallback(async () => {
    if (!editor || !url.trim()) return;

    const href = normalizeHttpUrlInput(url) ?? url.trim();
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    const isInsideLink = editor.isActive('link');
    const nextDisplayText = displayText.trim();

    // [why] Editing a link via toolbar should be able to update both href and
    // displayed label. For cursor-inside-link edits, replace the full link text.
    if (nextDisplayText && (hasSelection || isInsideLink)) {
      let replaceFrom = from;
      let replaceTo = to;

      if (!hasSelection && isInsideLink) {
        const linkType = editor.state.schema.marks.link;
        const range = getMarkRange(editor.state.selection.$from, linkType);
        if (range) {
          replaceFrom = range.from;
          replaceTo = range.to;
        }
      }

      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: replaceFrom, to: replaceTo },
          {
            type: 'text',
            text: nextDisplayText,
            marks: [{ type: 'link', attrs: { href, target: '_blank', class: LINK_CLASS_BUTTON } }],
          },
        )
        .run();

      onClose();
      return;
    }

    if (hasSelection) {
      // Apply link mark to existing selection
      editor.chain().focus().setLink({ href, target: '_blank', class: LINK_CLASS_BUTTON }).run();
    } else if (isInsideLink) {
      // Update the active link mark when cursor is inside an existing link.
      editor.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank', class: LINK_CLASS_BUTTON }).run();
    } else if (nextDisplayText) {
      // Insert new text node with link mark
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'text',
            text: nextDisplayText,
            marks: [{ type: 'link', attrs: { href, target: '_blank', class: LINK_CLASS_BUTTON } }],
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    } else {
      // [why] Prefer server-side page metadata title (same source as browser tab title)
      // and fall back to URL-derived label when metadata isn't available.
      const inlineTitle = await resolveInlineLabel(href);
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'text',
            text: inlineTitle,
            marks: [{ type: 'link', attrs: { href, target: '_blank', class: LINK_CLASS_BUTTON } }],
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    }

    onClose();
  }, [editor, url, displayText, onClose]);

  const handleRemoveLink = useCallback(() => {
    if (!editor) return;

    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().unsetLink().run();
    }

    onClose();
  }, [editor, onClose]);

  const canRemoveLink = Boolean(editor?.isActive('link'));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleInsert();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const inputCls =
    'w-full rounded-md border border-border bg-bg-overlay px-3 py-2 text-sm text-base placeholder:text-subtle outline-none focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-bg-base p-4 shadow-2xl"
      // [why] Prevent mousedown inside the popover from blurring the editor
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-3">
        <label htmlFor="link-insert-url" className="mb-1 block text-xs font-semibold text-subtle">
          Link <span className="text-danger">*</span>
        </label>
        <input
          id="link-insert-url"
          ref={urlInputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a link"
          className={inputCls}
        />
      </div>

      <div className="mb-1">
        <label htmlFor="link-insert-display" className="mb-1 block text-xs font-semibold text-subtle">
          Display text <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id="link-insert-display"
          type="text"
          value={displayText}
          onChange={(e) => setDisplayText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Text to display"
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-muted">Give this link a title or description</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onMouseDown={(e) => { e.preventDefault(); handleRemoveLink(); }}
          disabled={!canRemoveLink}
          className="px-3 py-1.5 text-sm text-muted hover:text-subtle"
        >
          Remove
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onMouseDown={(e) => { e.preventDefault(); onClose(); }}
            className="px-3 py-1.5 text-sm text-muted hover:text-subtle"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onMouseDown={(e) => { e.preventDefault(); void handleInsert(); }}
            disabled={!url.trim()}
            className="px-3 py-1.5 text-sm"
          >
            Insert
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LinkInsertPopover;
