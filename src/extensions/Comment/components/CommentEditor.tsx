// Rich text editor for composing or editing a comment.
// Uses Tiptap with the shared OneLineToolbar (single-line, no wrapping).
// Integrates offline draft persistence: debounce-saves on every keystroke,
// background-syncs to server when online, restores draft on card open, and
// queues the POST with an idempotency key when submitting while offline.
import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { useSelector } from 'react-redux';
import OneLineToolbar from '~/extensions/Card/components/OneLineToolbar';
import { useAttachmentUpload } from '~/extensions/Attachments/hooks/useAttachmentUpload';
import { InlineUploadPreview } from '~/extensions/Attachments/components/InlineUploadPreview';
import {
  useOfflineCommentDraft,
  type DraftStatus,
} from '~/extensions/OfflineDrafts/hooks/useOfflineCommentDraft';
import { selectCurrentUser, selectAccessToken } from '~/slices/authSlice';
import { selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';

interface Props {
  boardId?: string;
  cardId?: string;
  initialValue?: string;
  placeholder?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

// Map draft status to a human-readable footer label — mirrors description editor.
function draftStatusLabel(status: DraftStatus): string | null {
  switch (status) {
    case 'saving_local': return 'Saving draft…';
    case 'saved_local':  return 'Draft saved locally';
    case 'syncing':      return 'Syncing draft…';
    case 'synced':       return 'Synced draft';
    case 'will_sync_when_online': return 'Will post when back online';
    case 'sync_failed':  return 'Sync failed';
    default:             return null;
  }
}

const CommentEditor = ({
  boardId,
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

  // Auth + workspace context needed by the offline draft hook
  const currentUser = useSelector(selectCurrentUser);
  const token = useSelector(selectAccessToken) ?? undefined;
  const workspaceId = useSelector(selectActiveWorkspaceId) ?? undefined;

  // File picker ref for attachment uploads
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment upload — only active when a cardId is provided
  const { uploads, upload: uploadFiles, removeEntry } = useAttachmentUpload({
    cardId: cardId ?? '',
  });

  // Offline draft integration
  const {
    restoredDraft,
    draftStatus,
    isSubmitPending,
    onContentChange: notifyDraftChange,
    handleSubmitIntent,
    clearDraft,
    retrySync,
    discardDraft,
  } = useOfflineCommentDraft({
    cardId,
    boardId,
    userId: currentUser?.id,
    workspaceId,
    token,
  });

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: initialValue || '',
    contentType: 'markdown',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      notifyDraftChange(editor.getMarkdown());
    },
  });

  // Restore offline draft into editor once it's loaded (async, after initial render)
  useEffect(() => {
    if (restoredDraft && editor && !editor.isDestroyed) {
      editor.commands.setContent(restoredDraft, { contentType: 'markdown' });
    }
  // [why] Only restore when the draft first becomes available — not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredDraft]);

  const handleSubmit = useCallback(async () => {
    if (!editor) return;
    const trimmed = editor.getMarkdown().trim();
    if (!trimmed) {
      setError('Comment cannot be empty');
      return;
    }
    setError(null);

    // Offline path: queue POST and show "Will post when back online"
    const handledOffline = handleSubmitIntent(trimmed);
    if (handledOffline) return;

    // Online path: submit normally then clear the draft
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      editor.commands.clearContent();
      clearDraft();
    } catch {
      setError('Failed to save comment');
    } finally {
      setSubmitting(false);
    }
  }, [editor, onSubmit, handleSubmitIntent, clearDraft]);

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

  const currentMarkdown = editor?.getMarkdown() ?? '';

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

      {/* Draft recovery banner — shown when a draft was restored from local/server storage */}
      {restoredDraft && draftStatus !== 'idle' && (
        <div
          data-testid="comment-draft-recovery-banner"
          className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <span>
            {draftStatus === 'will_sync_when_online'
              ? 'Unsaved comment (will post when back online)'
              : 'Unsaved comment draft restored'}
          </span>
          <button
            type="button"
            className="ml-4 text-gray-400 hover:text-gray-300 underline transition-colors"
            onClick={discardDraft}
            data-testid="comment-draft-discard"
          >
            Discard
          </button>
        </div>
      )}

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

      {/* Draft status footer */}
      {draftStatus !== 'idle' && (
        <div
          data-testid="comment-draft-status-footer"
          className="flex items-center gap-2 text-[11px]"
        >
          {draftStatus === 'sync_failed' ? (
            <>
              <span className="text-red-500 dark:text-red-400">
                {isSubmitPending ? 'Post failed' : 'Sync failed'}
              </span>
              <button
                type="button"
                className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                onClick={() => retrySync(currentMarkdown)}
                data-testid="comment-draft-retry-sync"
              >
                {/* [why] "Retry Post" clarifies the user's pending action vs a background sync retry */}
                {isSubmitPending ? 'Retry Post' : 'Retry'}
              </button>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-300 underline transition-colors"
                onClick={discardDraft}
                data-testid="comment-draft-discard-footer"
              >
                Discard draft
              </button>
            </>
          ) : (
            <span
              className={
                draftStatus === 'will_sync_when_online'
                  ? 'text-amber-500 dark:text-amber-400'
                  : draftStatus === 'synced'
                    ? 'text-green-500 dark:text-green-400'
                    : 'text-gray-400 dark:text-slate-500'
              }
            >
              {isSubmitPending && draftStatus === 'will_sync_when_online'
                ? 'Will post when back online'
                : draftStatusLabel(draftStatus)}
            </span>
          )}
        </div>
      )}

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

