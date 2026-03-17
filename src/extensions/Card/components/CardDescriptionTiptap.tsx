// CardDescriptionTiptap — rich text markdown editor using Tiptap with offline draft support.
import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { marked } from 'marked';
import { useSelector } from 'react-redux';
import OneLineToolbar from './OneLineToolbar';
import { useAttachmentUpload } from '~/extensions/Attachments/hooks/useAttachmentUpload';
import { InlineUploadPreview } from '~/extensions/Attachments/components/InlineUploadPreview';
import {
  useOfflineDescriptionDraft,
  type DraftStatus,
} from '~/extensions/OfflineDrafts/hooks/useOfflineDescriptionDraft';
import { selectCurrentUser, selectAccessToken } from '~/slices/authSlice';
import { selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';

interface Props {
  boardId: string;
  cardId?: string;
  description: string;
  onSave: (description: string) => void;
  disabled?: boolean;
}

// Map draft status to a human-readable footer label.
function draftStatusLabel(status: DraftStatus): string | null {
  switch (status) {
    case 'saving_local': return 'Saving draft…';
    case 'saved_local':  return 'Draft saved locally';
    case 'syncing':      return 'Syncing draft…';
    case 'synced':       return 'Synced draft';
    case 'will_sync_when_online': return 'Will sync when online';
    case 'sync_failed':  return 'Sync failed';
    default:             return null;
  }
}

const CardDescriptionTiptap = ({ boardId, cardId, description, onSave, disabled }: Props) => {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(description);
  const [editMode, setEditMode] = useState<'rich' | 'markdown'>('rich');
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Auth + workspace context needed by the offline draft hook
  const currentUser = useSelector(selectCurrentUser);
  const token = useSelector(selectAccessToken) ?? undefined;
  const workspaceId = useSelector(selectActiveWorkspaceId) ?? undefined;

  // File picker input ref for attachment uploads
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment upload — only active when a cardId is provided
  const { uploads, upload: uploadFiles, removeEntry } = useAttachmentUpload({
    cardId: cardId ?? '',
  });

  // Offline draft integration
  const {
    restoredDraft,
    draftStatus,
    onContentChange: notifyDraftChange,
    handleSaveIntent,
    clearDraft,
    retrySync,
    discardDraft,
  } = useOfflineDescriptionDraft({
    cardId,
    boardId,
    userId: currentUser?.id,
    workspaceId,
    token,
    currentDescription: description,
  });

  // Tiptap editor instance
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: description || '',
    contentType: 'markdown',
    editable: editing && !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown();
      setDraft(markdown);
      notifyDraftChange(markdown);
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
      // [why] Prefer the restored offline draft over the saved description so the
      // user never loses work that hasn't been synced yet.
      const startContent = restoredDraft ?? draft ?? description ?? '';
      editor.commands.setContent(startContent, { contentType: 'markdown' });
      editor.commands.focus('end');
      if (restoredDraft) setDraft(restoredDraft);
    }
    setEditMode('rich');
  }, [disabled, editor, draft, description, restoredDraft]);

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

    // [why] If offline, queue the save for replay rather than calling onSave
    // which would silently fail or show a network error.
    const handledOffline = handleSaveIntent(markdown);
    if (handledOffline) {
      // Stay in editing mode so the user can see the "Will sync when online" status
      return;
    }

    onSave(markdown);
    clearDraft();
    setEditing(false);
  }, [draft, onSave, editor, editMode, handleSaveIntent, clearDraft]);

  const handleCancel = useCallback(() => {
    if (editor) editor.commands.setContent(description || '', { contentType: 'markdown' });
    setDraft(description);
    discardDraft();
    setEditing(false);
  }, [description, editor, discardDraft]);

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
          {/* Hidden file input for attachment upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.tar,.gz,audio/*"
            className="hidden"
            onChange={handleFileInputChange}
            data-testid="description-attachment-input"
          />

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
                {...(cardId ? { onAttach: handleAttach } : {})}
              />
              <div className="relative min-h-[180px] flex-1 overflow-y-auto overscroll-contain rounded-b-lg">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-white via-white to-transparent dark:from-slate-900 dark:via-slate-900" />
                <EditorContent
                  editor={editor}
                  className="relative z-0 px-3 pb-3 pt-4 [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-gray-900 dark:[&_.ProseMirror]:text-slate-100 [&_.ProseMirror]:prose [&_.ProseMirror]:prose-sm [&_.ProseMirror]:max-w-none dark:[&_.ProseMirror]:prose-invert [&_.ProseMirror>*:first-child]:mt-0"
                />
              </div>

              {/* Inline upload previews — shown while files are in-flight */}
              {uploads.length > 0 && (
                <div
                  aria-label="File uploads"
                  className="flex flex-col gap-1 border-t border-gray-200 dark:border-slate-700 p-2"
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
          ) : (
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                notifyDraftChange(e.target.value);
              }}
              onKeyDown={handleEditorKeyDown}
              className="w-full min-h-[180px] rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-gray-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Write markdown..."
            />
          )}

          <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
            Save as markdown. Shortcut: Ctrl/Cmd+Enter to save, Escape to cancel.
          </p>

          {/* Draft status footer */}
          {draftStatus !== 'idle' && (
            <div
              data-testid="draft-status-footer"
              className="mt-1 flex items-center gap-2 text-[11px]"
            >
              {draftStatus === 'sync_failed' ? (
                <>
                  <span className="text-red-500 dark:text-red-400">Sync failed</span>
                  <button
                    type="button"
                    className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                    onClick={() => retrySync(editMode === 'rich' && editor ? editor.getMarkdown() : draft)}
                    data-testid="draft-retry-sync"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-300 underline transition-colors"
                    onClick={discardDraft}
                    data-testid="draft-discard"
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
                  {draftStatusLabel(draftStatus)}
                </span>
              )}
            </div>
          )}

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
          {/* Draft recovery banner — shown in view mode when a local/synced draft differs from saved content */}
          {restoredDraft && !editing && !disabled && (
            <div
              data-testid="draft-recovery-banner"
              className="mb-2 flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300"
            >
              <span>You have an unsaved draft</span>
              <button
                type="button"
                className="ml-4 text-indigo-500 hover:text-indigo-400 underline"
                onClick={handleEnterEdit}
              >
                Resume editing
              </button>
            </div>
          )}
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
