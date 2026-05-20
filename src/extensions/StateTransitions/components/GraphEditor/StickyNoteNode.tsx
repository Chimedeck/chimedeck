import { useEffect, useRef } from 'react';
import { PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { NodeProps } from '@xyflow/react';
import type { GraphEditorNode } from './useGraphEditor';
import translations from '../../translations/en.json';

const StickyNoteNode = ({ id, data, selected }: NodeProps<GraphEditorNode>) => {
  const noteContent = data.noteContent ?? '';
  const isEditing = data.isEditing ?? false;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncTextareaHeight = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '0px';
    textareaRef.current.style.height = `${String(textareaRef.current.scrollHeight)}px`;
  };

  useEffect(() => {
    if (!isEditing) return;
    syncTextareaHeight();
  }, [isEditing, noteContent]);

  return (
    <div className={`min-h-[120px] min-w-[220px] max-w-[260px] rounded-lg border border-amber-300 bg-amber-100 p-3 shadow-md dark:border-amber-700 dark:bg-amber-900/60 ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-amber-900 dark:text-amber-100">
        <div className="flex items-center gap-1.5">
          <PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-wide">{translations['StateTransitions.stickyNoteTitle']}</span>
        </div>
        <button
          type="button"
          aria-label={translations['StateTransitions.deleteStickyNote']}
          className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data.onDeleteNode?.(id);
          }}
        >
          <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          value={noteContent}
          rows={1}
          className="nodrag w-full overflow-hidden rounded border border-amber-400/60 bg-amber-50 px-2 py-1.5 text-sm text-amber-900 outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100"
          placeholder={translations['StateTransitions.stickyNotePlaceholder']}
          onChange={(event) => {
            data.onNoteContentChange?.(id, event.target.value);
            syncTextareaHeight();
          }}
          onBlur={() => {
            data.onFinishNoteEdit?.(id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              data.onFinishNoteEdit?.(id);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="w-full text-left text-sm text-amber-900/90 dark:text-amber-100/90"
          onDoubleClick={(event) => {
            event.preventDefault();
            data.onStartNoteEdit?.(id);
          }}
          title={translations['StateTransitions.stickyNoteDoubleClickHint']}
        >
          {noteContent.trim().length > 0 ? noteContent : translations['StateTransitions.stickyNotePlaceholder']}
        </button>
      )}
    </div>
  );
};

export default StickyNoteNode;
