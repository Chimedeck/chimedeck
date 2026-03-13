// CardDescription — Markdown textarea editor with live preview toggle.
// Edit mode: <MentionInput> with auto-resize. Preview mode: rendered HTML via marked.
// Preview mode supports a "Show more" toggle when the description is long.
import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import MentionInput from '~/common/components/MentionInput/MentionInput';
import renderMentions from '~/common/components/MentionInput/renderMentions';

interface Props {
  boardId: string;
  description: string;
  onSave: (description: string) => void; // debounced by caller
  disabled?: boolean;
}

const DEBOUNCE_MS = 800;
// Characters threshold above which we render the "Show more" toggle in preview mode
const SHOW_MORE_THRESHOLD = 400;

const CardDescription = ({ boardId, description, onSave, disabled }: Props) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  const [draft, setDraft] = useState(description);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes
  useEffect(() => {
    setDraft(description);
  }, [description]);

  // Collapse back when switching modes
  useEffect(() => {
    setExpanded(false);
  }, [mode]);

  const handleChange = useCallback(
    (val: string) => {
      setDraft(val);
      // Debounced auto-save
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onSave(val), DEBOUNCE_MS);
    },
    [onSave],
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const previewHtml = marked.parse(draft || '_No description yet._') as string;
  const isLong = draft.length > SHOW_MORE_THRESHOLD;

  return (
    <section aria-label="Description">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
          Description
        </h3>
        {!disabled && (
          <button
            type="button"
            className="text-xs text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
            onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
          >
            {mode === 'edit' ? 'Preview' : 'Edit'}
          </button>
        )}
      </div>

      {mode === 'edit' && !disabled ? (
        <MentionInput
          boardId={boardId}
          value={draft}
          onChange={handleChange}
          placeholder="Add a more detailed description…"
          className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 text-gray-700 dark:text-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] font-mono"
          aria-label="Card description"
        />
      ) : (
        <div>
          <div className="relative">
            <div
              className={[
                'prose dark:prose-invert prose-sm max-w-none text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 min-h-[80px]',
                isLong && !expanded ? 'overflow-hidden' : '',
              ].join(' ')}
              style={isLong && !expanded ? { maxHeight: '12rem' } : undefined}
              // Safe: marked output is trusted content from the user's own input
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
            {/* Gradient overlay when truncated */}
            {isLong && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent rounded-b-lg pointer-events-none" />
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
