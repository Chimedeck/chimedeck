// CardDescriptionTiptap — rich text markdown editor using Tiptap.
import { useState, useEffect, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { marked } from 'marked';
import OneLineToolbar from './OneLineToolbar';

interface Props {
  boardId: string;
  description: string;
  onSave: (description: string) => void;
  disabled?: boolean;
}

const CardDescriptionTiptap = ({ boardId: _boardId, description, onSave, disabled }: Props) => {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(description);
  const [editMode, setEditMode] = useState<'rich' | 'markdown'>('rich');
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Tiptap editor instance
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: description || '',
    contentType: 'markdown',
    editable: editing && !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setDraft(editor.getMarkdown());
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(editing && !disabled);
    }
  }, [editor, editing, disabled]);
  
  const handleEnterEdit = useCallback(() => {
    if (disabled) return;
    setEditing(true);
    if (editor) {
      editor.commands.setContent(draft || description || '', { contentType: 'markdown' });
      editor.commands.focus('end');
    }
    setEditMode('rich');
  }, [disabled, editor, draft, description]);

  const handleModeChange = useCallback(
    (mode: 'rich' | 'markdown') => {
      if (!editor) {
        setEditMode(mode);
        return;
      }

      if (mode === 'markdown' && editMode === 'rich') {
        setDraft(editor.getMarkdown());
      }

      if (mode === 'rich' && editMode === 'markdown') {
        editor.commands.setContent(draft || '', { contentType: 'markdown' });
      }

      setEditMode(mode);
    },
    [editor, editMode, draft],
  );

  // Sync external description changes when not editing
  useEffect(() => {
    if (!editing && editor) {
      editor.commands.setContent(description || '', { contentType: 'markdown' });
      setDraft(description);
    }
  }, [description, editing, editor]);

  const handleSave = useCallback(() => {
    const markdown = editMode === 'rich' && editor ? editor.getMarkdown() : draft;
    setDraft(markdown);
    onSave(markdown);
    setEditing(false);
  }, [draft, onSave, editor, editMode]);

  const handleCancel = useCallback(() => {
    if (editor) editor.commands.setContent(description || '', { contentType: 'markdown' });
    setDraft(description);
    setEditing(false);
  }, [description, editor]);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  const isEmpty = !draft.trim();
  const isLong = draft.length > 400;
  const previewHtml = marked.parse(draft || '') as string;

  return (
    <section aria-label="Description">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
        Description
      </h3>
      {editing && !disabled ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex rounded-md border border-gray-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                className={`px-2 py-1 text-xs ${editMode === 'rich' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300'}`}
                onClick={() => handleModeChange('rich')}
              >
                Rich text
              </button>
              <button
                type="button"
                className={`px-2 py-1 text-xs ${editMode === 'markdown' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300'}`}
                onClick={() => handleModeChange('markdown')}
              >
                Markdown
              </button>
            </div>
          </div>

          {editMode === 'rich' ? (
            <div className="flex max-h-[55vh] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              {/* Single-line toolbar: primary controls always visible, secondary behind + */}
              <OneLineToolbar
                editor={editor}
                overflowOpen={overflowOpen}
                onToggleOverflow={() => setOverflowOpen((o) => !o)}
              />
              <div className="relative min-h-[180px] flex-1 overflow-y-auto overscroll-contain rounded-b-lg">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-white via-white to-transparent dark:from-slate-900 dark:via-slate-900" />
                <EditorContent
                  editor={editor}
                  className="relative z-0 px-3 pb-3 pt-4 [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-gray-900 dark:[&_.ProseMirror]:text-slate-100 [&_.ProseMirror]:prose [&_.ProseMirror]:prose-sm [&_.ProseMirror]:max-w-none dark:[&_.ProseMirror]:prose-invert [&_.ProseMirror>*:first-child]:mt-0"
                />
              </div>
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              className="w-full min-h-[180px] rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-gray-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Write markdown..."
            />
          )}

          <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
            Save as markdown. Shortcut: Ctrl/Cmd+Enter to save, Escape to cancel.
          </p>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              type="button"
              className="px-3 py-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 text-xs transition-colors"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            aria-label={isEmpty ? 'Add a description (click to edit)' : 'Description (click to edit)'}
            className={[
              'w-full text-left rounded-lg p-3 min-h-[80px] transition-colors',
              disabled
                ? 'cursor-default'
                : 'cursor-text hover:bg-gray-100 dark:hover:bg-slate-800/80',
              isEmpty
                ? 'text-gray-400 dark:text-slate-500 text-sm italic bg-gray-50 dark:bg-slate-800/50'
                : 'prose dark:prose-invert prose-sm max-w-none text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/50',
              isLong && !expanded ? 'overflow-hidden' : '',
            ].join(' ')}
            style={isLong && !expanded ? { maxHeight: '12rem' } : undefined}
            onClick={handleEnterEdit}
            disabled={disabled}
            {...(!isEmpty && { dangerouslySetInnerHTML: { __html: previewHtml } })}
          >
            {isEmpty ? 'Add a more detailed description…' : undefined}
          </button>
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

export default CardDescriptionTiptap;
