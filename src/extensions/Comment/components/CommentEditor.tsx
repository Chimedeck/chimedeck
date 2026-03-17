// Rich text editor for composing or editing a comment.
// Uses Tiptap with the shared OneLineToolbar (single-line, no wrapping).
// @mention support is deferred to the + overflow menu in a future iteration.
import { useState, useCallback, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import OneLineToolbar from '~/extensions/Card/components/OneLineToolbar';
import { useAttachmentUpload } from '~/extensions/Attachments/hooks/useAttachmentUpload';
import { InlineUploadPreview } from '~/extensions/Attachments/components/InlineUploadPreview';

interface Props {
  boardId?: string;
  cardId?: string;
  initialValue?: string;
  placeholder?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const CommentEditor = ({
  boardId: _boardId,
  cardId,
  initialValue = '',
  placeholder = 'Write a comment…',
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  // File picker ref for attachment uploads
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment upload — only active when a cardId is provided
  const { uploads, upload: uploadFiles, removeEntry } = useAttachmentUpload({
    cardId: cardId ?? '',
  });

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: initialValue || '',
    contentType: 'markdown',
    immediatelyRender: false,
  });

  const handleSubmit = useCallback(async () => {
    if (!editor) return;
    const trimmed = editor.getMarkdown().trim();
    if (!trimmed) {
      setError('Comment cannot be empty');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      editor.commands.clearContent();
    } catch {
      setError('Failed to save comment');
    } finally {
      setSubmitting(false);
    }
  }, [editor, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  // Open file picker for attachment (only when cardId is available)
  const handleAttach = useCallback(() => {
    if (!cardId) return;
    fileInputRef.current?.click();
  }, [cardId]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) uploadFiles(files);
      e.target.value = '';
    },
    [uploadFiles],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden file input for attachment upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.tar,.gz,audio/*"
        className="hidden"
        onChange={handleFileInputChange}
        data-testid="comment-attachment-input"
      />

      <div
        className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden focus-within:ring-2 focus-within:ring-blue-400"
        onKeyDown={handleKeyDown}
      >
        {/* Single-line toolbar — never wraps */}
        <OneLineToolbar
          editor={editor}
          overflowOpen={overflowOpen}
          onToggleOverflow={() => setOverflowOpen((o) => !o)}
          {...(cardId ? { onAttach: handleAttach } : {})}
        />
        <EditorContent
          editor={editor}
          aria-label="Comment text"
          aria-placeholder={placeholder}
          className="px-3 py-2 text-sm [&_.ProseMirror]:min-h-[72px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-gray-900 dark:[&_.ProseMirror]:text-slate-100 [&_.ProseMirror]:prose [&_.ProseMirror]:prose-sm [&_.ProseMirror]:max-w-none dark:[&_.ProseMirror]:prose-invert [&_.ProseMirror>*:first-child]:mt-0 [&_.ProseMirror>*:last-child]:mb-0"
        />

        {/* Inline upload previews — shown while files are in-flight */}
        {uploads.length > 0 && (
          <div
            aria-label="File uploads"
            className="flex flex-col gap-1 border-t border-gray-300 dark:border-slate-700 p-2"
          >
            {uploads.map((entry) => (
              <InlineUploadPreview
                key={entry.clientId}
                entry={entry}
                onCancel={removeEntry}
              />
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default CommentEditor;

