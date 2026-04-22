// CardDescription — inline click-to-edit with markdown preview.
// View mode: renders markdown; click anywhere to enter edit mode.
// Edit mode: plain textarea (with @mention support). Save with Ctrl/Cmd+Enter or
// the Save button. Cancel with Escape or the Cancel button.
import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import MentionInput from '~/common/components/MentionInput/MentionInput';
import Button from '../../../common/components/Button';

/**
 * Add target="_blank" rel="noopener noreferrer" to external links that don't already
 * have a target attribute and whose href is not a bare anchor (#...).
 */
function addLinkTargetBlank(html: string): string {
  return html.replace(
    /<a(?=[^>]*\bhref="(?!#))(?![^>]*\btarget=)/gi,
    '<a target="_blank" rel="noopener noreferrer"',
  );
}

interface Props {
  boardId: string;
  description: string;
  onSave: (description: string) => void;
  disabled?: boolean;
}

const SHOW_MORE_THRESHOLD = 400;

const CardDescription = ({ boardId, description, onSave, disabled }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [expanded, setExpanded] = useState(false);

  // Sync external description changes when not editing
  useEffect(() => {
    if (!editing) setDraft(description);
  }, [description, editing]);

  const handleEnterEdit = useCallback(() => {
    if (disabled) return;
    setDraft(description);
    setEditing(true);
  }, [disabled, description]);

  const handleSave = useCallback(() => {
    onSave(draft);
    setEditing(false);
  }, [draft, onSave]);

  const handleCancel = useCallback(() => {
    setDraft(description);
    setEditing(false);
  }, [description]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  const handleDescriptionClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const link = (e.target as HTMLElement).closest('a');
      if (link) {
        // [why] Intercept link clicks so they open in a new tab and don't trigger
        // edit mode. window.open is used for cross-browser reliability.
        const href = link.getAttribute('href');
        if (href && href !== '#') {
          e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      handleEnterEdit();
    },
    [handleEnterEdit],
  );

  const previewHtml = addLinkTargetBlank(marked.parse(draft || '') as string);
  const isEmpty = !draft.trim();
  const isLong = draft.length > SHOW_MORE_THRESHOLD;

  return (
    <section aria-label="Description">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
        Description
      </h3>

      {editing && !disabled ? (
        <div>
          <MentionInput
            boardId={boardId}
            value={draft}
            onChange={setDraft}
            onKeyDown={handleKeyDown}
            placeholder="Add a more detailed description…"
            className="w-full bg-bg-overlay border border-border rounded-lg p-3 text-base text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] font-mono"
            aria-label="Card description editor"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={handleSave}
            >
              Save
            </Button>
            <button
              type="button"
              className="px-3 py-1 text-muted hover:text-base text-xs transition-colors"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="relative">
            {/* Click-to-edit region — cursor signals editability */}
            <div
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={isEmpty ? 'Add a description (click to edit)' : 'Description (click to edit)'}
              className={[
                'rounded-lg p-3 min-h-[80px] transition-colors',
                disabled
                  ? 'cursor-default'
                  : 'cursor-text hover:bg-bg-overlay',
                isEmpty
                  ? 'text-muted text-sm italic bg-bg-overlay'
                  : 'prose dark:prose-invert prose-sm max-w-none text-base break-words [&_a]:break-all',
                isLong && !expanded ? 'overflow-hidden' : '',
              ].join(' ')}
              style={isLong && !expanded ? { maxHeight: '12rem' } : undefined}
              onClick={handleDescriptionClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEnterEdit();
                }
              }}
              // Safe: marked output is trusted content from the user's own input
              {...(!isEmpty && { dangerouslySetInnerHTML: { __html: previewHtml } })}
            >
              {isEmpty ? 'Add a more detailed description…' : undefined}
            </div>
            {/* Gradient overlay when truncated */}
            {isLong && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 to-transparent rounded-b-lg pointer-events-none" />
            )}
          </div>
          {isLong && (
            <button
              type="button"
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? 'Show less ↑' : 'Show more ↓'}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default CardDescription;

