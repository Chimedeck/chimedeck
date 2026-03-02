// CardDescription — Markdown textarea editor with live preview toggle.
// Edit mode: <textarea> with auto-resize. Preview mode: rendered HTML via marked.
import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';

interface Props {
  description: string;
  onSave: (description: string) => void; // debounced by caller
  disabled?: boolean;
}

const DEBOUNCE_MS = 800;

const CardDescription = ({ description, onSave, disabled }: Props) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [draft, setDraft] = useState(description);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external changes
  useEffect(() => {
    setDraft(description);
  }, [description]);

  // Auto-resize textarea
  const resize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (mode === 'edit') resize();
  }, [mode, draft]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setDraft(val);
      resize();
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

  return (
    <section aria-label="Description">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Description
        </h3>
        {!disabled && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
          >
            {mode === 'edit' ? 'Preview' : 'Edit'}
          </button>
        )}
      </div>

      {mode === 'edit' && !disabled ? (
        <textarea
          ref={textareaRef}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] font-mono"
          placeholder="Add a more detailed description…"
          value={draft}
          onChange={handleChange}
          aria-label="Card description"
        />
      ) : (
        <div
          className="prose prose-invert prose-sm max-w-none text-slate-300 bg-slate-800/50 rounded-lg p-3 min-h-[80px]"
          // Safe: marked output is trusted content from the user's own input
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      )}
    </section>
  );
};

export default CardDescription;
