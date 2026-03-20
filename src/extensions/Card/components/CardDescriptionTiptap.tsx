// CardDescriptionTiptap — rich text markdown editor using Tiptap with offline draft support.
import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import { marked } from 'marked';
import { useSelector } from 'react-redux';
import OneLineToolbar from './OneLineToolbar';
import type { Attachment } from '~/extensions/Attachments/types';
import { useAttachmentUpload } from '~/extensions/Attachments/hooks/useAttachmentUpload';
import { InlineUploadPreview } from '~/extensions/Attachments/components/InlineUploadPreview';
import { CardAssetPicker } from '~/extensions/Comment/components/CardAssetPicker';
import { listAttachments } from '~/extensions/Attachments/api';
import InlineImage from '~/extensions/Comment/extensions/InlineImage';
import { buildMentionExtension } from '~/extensions/Mention/TiptapMentionExtension';
import {
  dehydrateCommentAttachmentMarkdown,
  hasAttachmentPlaceholder,
  hydrateCommentAttachmentMarkdown,
  resolveAttachmentMarkdownUrl,
  stripCommentAttachmentPlaceholders,
} from '~/common/utils/attachmentMarkdown';
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

function buildDescriptionMarkdown(editor: Editor, attachments: Attachment[]): string {
  let markdown = editor.getMarkdown() || '';
  const imageSnippets: string[] = [];

  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'image') return;
    const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
    if (!src) return;
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
    imageSnippets.push(`![${alt}](${src})`);
  });

  imageSnippets.forEach((snippet) => {
    const urlMatch = /\((.*)\)$/.exec(snippet);
    const url = urlMatch?.[1] ?? '';
    if (url && markdown.includes(url)) return;
    markdown = markdown.trim().length > 0
      ? `${markdown.trim()}\n\n${snippet}`
      : snippet;
  });

  return dehydrateCommentAttachmentMarkdown(markdown, attachments);
}

function escapeMdLabel(value: string): string {
  return value
    .replaceAll('[', String.raw`\[`)
    .replaceAll(']', String.raw`\]`);
}

function buildAttachmentSnippet({ name, url, isImage }: { name: string; url: string; isImage: boolean }): string {
  const safeName = escapeMdLabel(name || 'attachment');
  return isImage
    ? `![${safeName}](${url}) `
    : `[${safeName}](${url}) `;
}

function insertSnippetAt(editor: Editor, pos: number, snippet: string): void {
  editor
    .chain()
    .focus()
    .insertContentAt(pos, snippet)
    .setTextSelection(pos + snippet.length)
    .run();
}

function resolvePendingHydratedContent(pendingContent: string | null, attachments: Attachment[]): string | null {
  if (!pendingContent) return null;
  if (hasAttachmentPlaceholder(pendingContent) && attachments.length === 0) return null;
  return hydrateCommentAttachmentMarkdown(pendingContent, attachments);
}

function getInitialEditorContent(initialValue: string, attachments: Attachment[]): string {
  if (hasAttachmentPlaceholder(initialValue) && attachments.length === 0) {
    return stripCommentAttachmentPlaceholders(initialValue);
  }
  return hydrateCommentAttachmentMarkdown(initialValue, attachments);
}

function looksLikeHtmlContent(value: string): boolean {
  return /<\/?[a-z][\w-]*(?:\s[^>]*)?>/i.test(value);
}

function buildEditorContentHtml(source: string, attachments: Attachment[]): string {
  const initialContent = getInitialEditorContent(source, attachments);
  if (!initialContent) return '';
  if (looksLikeHtmlContent(initialContent)) return initialContent;
  return marked.parse(initialContent) as string;
}

function setEditorContentFromSource(editor: Editor, source: string, attachments: Attachment[]): void {
  const htmlContent = buildEditorContentHtml(source, attachments);
  if (!htmlContent) {
    editor.commands.clearContent();
    return;
  }
  editor.commands.setContent(htmlContent);
}

function insertAttachmentAt(editor: Editor, attachment: Attachment, pos: number): boolean {
  const isImage = attachment.content_type?.startsWith('image/') ?? false;
  const url = resolveAttachmentMarkdownUrl(attachment, isImage);
  if (!url) return false;

  if (isImage) {
    editor
      .chain()
      .focus()
      .insertContentAt(pos, [
        {
          type: 'image',
          attrs: {
            src: url,
            alt: attachment.name,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .setTextSelection(pos + 2)
      .run();
    return true;
  }

  insertSnippetAt(
    editor,
    pos,
    buildAttachmentSnippet({ name: attachment.name, url, isImage }),
  );
  return true;
}

function getDraftStatusClass(status: DraftStatus): string {
  if (status === 'will_sync_when_online') return 'text-amber-500 dark:text-amber-400';
  if (status === 'synced') return 'text-green-500 dark:text-green-400';
  return 'text-gray-400 dark:text-slate-500';
}

function buildDescriptionSaveMarkdown(
  editMode: 'rich' | 'markdown',
  editor: Editor | null,
  draft: string,
  attachments: Attachment[],
): string {
  if (editMode === 'rich' && editor) {
    return buildDescriptionMarkdown(editor, attachments);
  }

  return dehydrateCommentAttachmentMarkdown(draft, attachments);
}

function buildPreviewMarkdown(markdown: string, attachments: Attachment[]): string {
  if (attachments.length > 0) {
    return hydrateCommentAttachmentMarkdown(markdown, attachments);
  }

  return stripCommentAttachmentPlaceholders(markdown);
}

const CardDescriptionTiptap = ({ boardId, cardId, description, onSave, disabled }: Props) => {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(description);
  const [editMode, setEditMode] = useState<'rich' | 'markdown'>('rich');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [cardAttachments, setCardAttachments] = useState<Attachment[]>([]);

  // Auth + workspace context needed by the offline draft hook
  const currentUser = useSelector(selectCurrentUser);
  const token = useSelector(selectAccessToken) ?? undefined;
  const workspaceId = useSelector(selectActiveWorkspaceId) ?? undefined;

  // File picker input ref for attachment uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertPosMap = useRef<Map<string, number>>(new Map());
  const editorRef = useRef<Editor | null>(null);
  const uploadFilesRef = useRef<((files: File[]) => string[]) | null>(null);
  const cardAttachmentsRef = useRef<Attachment[]>([]);
  const pendingHydratedContentRef = useRef<string | null>(description || null);
  const pendingAttachmentInsertRef = useRef<Map<string, number>>(new Map());

  const replaceCardAttachments = useCallback((attachments: Attachment[]) => {
    cardAttachmentsRef.current = attachments;
    setCardAttachments(attachments);
  }, []);

  const prependCardAttachment = useCallback((attachment: Attachment) => {
    setCardAttachments((prev) => {
      const next = [attachment, ...prev.filter((entry) => entry.id !== attachment.id)];
      cardAttachmentsRef.current = next;
      return next;
    });
  }, []);

  const loadCardAttachments = useCallback(async () => {
    if (!cardId) {
      replaceCardAttachments([]);
      return;
    }
    try {
      const res = await listAttachments({ cardId });
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      replaceCardAttachments(sorted);
    } catch {
      replaceCardAttachments([]);
    }
  }, [cardId, replaceCardAttachments]);

  useEffect(() => {
    void loadCardAttachments();
  }, [loadCardAttachments]);

  // Keep card attachments fresh when opening the picker.
  useEffect(() => {
    if (!assetPickerOpen) return;
    void loadCardAttachments();
  }, [assetPickerOpen, loadCardAttachments]);

  // Attachment upload — only active when a cardId is provided.
  const { uploads, upload: uploadFiles, removeEntry, flush: flushUploads } = useAttachmentUpload({
    cardId: cardId ?? '',
    deferred: true,
    onSuccess(attachment: Attachment, clientId: string) {
      prependCardAttachment(attachment);
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      const savedPos = insertPosMap.current.get(clientId);
      insertPosMap.current.delete(clientId);
      const docSize = ed.state.doc.content.size;
      const insertAt = savedPos === undefined ? ed.state.selection.anchor : Math.min(savedPos, docSize);
      if (insertAttachmentAt(ed, attachment, insertAt)) return;
      // [why] Some fresh upload responses arrive before the card attachment URLs are
      // hydrated. Retry once the follow-up attachment list fetch returns URLs.
      pendingAttachmentInsertRef.current.set(attachment.id, insertAt);
    },
  });
  uploadFilesRef.current = uploadFiles;

  // Offline draft integration
  const {
    restoredDraft,
    draftStatus,
    isSavePending,
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
    extensions: [StarterKit, Markdown, InlineImage, buildMentionExtension(boardId)],
    content: buildEditorContentHtml(description || '', cardAttachmentsRef.current),
    editable: editing && !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (!editor.isEditable) return;
      const markdown = buildDescriptionMarkdown(editor, cardAttachmentsRef.current);
      setDraft(markdown);
      notifyDraftChange(markdown);
    },
    editorProps: {
      // [why] Apply prose classes directly on ProseMirror so Tailwind Typography
      // descendant selectors (.prose ul, .prose blockquote, etc.) work correctly.
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none text-gray-900 dark:text-slate-100',
      },
      handleDrop(view, event, _slice, moved) {
        if (moved || !event.dataTransfer) return false;
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos ?? view.state.doc.content.size;
        const ids = uploadFilesRef.current?.(files) ?? [];
        ids.forEach((id) => insertPosMap.current.set(id, pos));
        void flushUploads()
          .then(() => loadCardAttachments())
          .catch(() => {});
        return true;
      },
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const hydratedContent = resolvePendingHydratedContent(
      pendingHydratedContentRef.current,
      cardAttachmentsRef.current,
    );
    if (!hydratedContent) return;
    setEditorContentFromSource(editor, hydratedContent, cardAttachmentsRef.current);
    pendingHydratedContentRef.current = null;
  }, [editor, cardAttachments, restoredDraft]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed || pendingAttachmentInsertRef.current.size === 0) return;

    pendingAttachmentInsertRef.current.forEach((pos, attachmentId) => {
      const attachment = cardAttachmentsRef.current.find((entry) => entry.id === attachmentId);
      if (!attachment) return;
      if (!insertAttachmentAt(ed, attachment, Math.min(pos, ed.state.doc.content.size))) return;
      pendingAttachmentInsertRef.current.delete(attachmentId);
    });
  }, [cardAttachments]);

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
      const startContent = restoredDraft ?? description ?? '';
      pendingHydratedContentRef.current = startContent;
      setEditorContentFromSource(editor, startContent, cardAttachmentsRef.current);
      editor.commands.focus('end');
      if (restoredDraft) setDraft(restoredDraft);
    }
    setEditMode('rich');
  }, [disabled, editor, description, restoredDraft]);

  const handleModeChange = useCallback(
    (mode: 'rich' | 'markdown') => {
      if (!editor) {
        setEditMode(mode);
        return;
      }

      if (mode === 'markdown' && editMode === 'rich') {
        setDraft(buildDescriptionMarkdown(editor, cardAttachmentsRef.current));
      }

      if (mode === 'rich' && editMode === 'markdown') {
        pendingHydratedContentRef.current = draft || '';
        setEditorContentFromSource(editor, draft || '', cardAttachmentsRef.current);
      }

      setEditMode(mode);
    },
    [editor, editMode, draft],
  );

  // Sync external description changes when not editing
  useEffect(() => {
    if (!editing && editor) {
      pendingHydratedContentRef.current = description || null;
      setEditorContentFromSource(editor, description || '', cardAttachmentsRef.current);
      setDraft(description);
    }
  }, [description, editing, editor]);

  useEffect(() => {
    if (!restoredDraft) return;
    pendingHydratedContentRef.current = restoredDraft;
  }, [restoredDraft]);

  const handleSave = useCallback(() => {
    const markdown = buildDescriptionSaveMarkdown(
      editMode,
      editor,
      draft,
      cardAttachmentsRef.current,
    );
    setDraft(markdown);

    // [why] If offline, queue the save for replay rather than calling onSave
    // which would silently fail or show a network error.
    const handledOffline = handleSaveIntent(markdown);
    if (handledOffline) {
      // Stay in editing mode so the user can see the "Will sync when online" status
      return;
    }

    onSave(markdown);
    // [why] Clear the draft immediately so the recovery banner doesn't reappear in the
    // same session. The restore effect only re-runs on cardId changes, not on description
    // prop changes, so without this the banner would show after every successful save.
    clearDraft();
    setAssetPickerOpen(false);
    setEditing(false);
  }, [draft, onSave, editor, editMode, handleSaveIntent, clearDraft]);

  const handleCancel = useCallback(() => {
    pendingHydratedContentRef.current = description || null;
    if (editor) {
      setEditorContentFromSource(editor, description || '', cardAttachmentsRef.current);
    }
    setDraft(description);
    discardDraft();
    setAssetPickerOpen(false);
    setEditing(false);
  }, [description, editor, discardDraft]);

  // Toggle the asset picker (existing card assets + upload action).
  const handleAttach = useCallback(() => {
    if (!cardId) return;
    if (editor && !editor.isDestroyed) {
      editor.commands.focus();
    }
    setAssetPickerOpen((prev) => !prev);
  }, [cardId, editor]);

  // Insert an existing card attachment at the current cursor position.
  const handleInsertExisting = useCallback((attachment: Attachment) => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return;
    insertAttachmentAt(ed, attachment, ed.state.selection.anchor);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        const pos = editor && !editor.isDestroyed
          ? editor.state.selection.anchor
          : 0;
        const ids = uploadFiles(files);
        ids.forEach((id) => insertPosMap.current.set(id, pos));
        void flushUploads()
          .then(() => loadCardAttachments())
          .catch(() => {});
      }
      setAssetPickerOpen(false);
      e.target.value = '';
    },
    [editor, uploadFiles, flushUploads, loadCardAttachments],
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

  const hydratedPreviewMarkdown = buildPreviewMarkdown(draft || '', cardAttachments);
  const isEmpty = !draft.trim();
  const isLong = draft.length > 400;
  const previewHtml = marked.parse(hydratedPreviewMarkdown) as string;
  const attachProps = cardId ? { onAttach: handleAttach } : undefined;

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
              <div className="relative">
                <OneLineToolbar
                  editor={editor}
                  overflowOpen={overflowOpen}
                  onToggleOverflow={() => setOverflowOpen((o) => !o)}
                  {...attachProps}
                />
                {assetPickerOpen && cardId && (
                  <CardAssetPicker
                    attachments={cardAttachments}
                    onUploadNew={() => fileInputRef.current?.click()}
                    onInsert={handleInsertExisting}
                    onClose={() => setAssetPickerOpen(false)}
                  />
                )}
              </div>
              <div className="relative min-h-[180px] flex-1 overflow-y-auto overscroll-contain rounded-b-lg">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-white via-white to-transparent dark:from-slate-900 dark:via-slate-900" />
                <EditorContent
                  editor={editor}
                  className="relative z-0 px-3 pb-3 pt-4 [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror>*:first-child]:mt-0"
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
                  <span className="text-red-500 dark:text-red-400">
                    {isSavePending ? 'Save failed' : 'Sync failed'}
                  </span>
                  <button
                    type="button"
                    className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                    onClick={() => retrySync(buildDescriptionSaveMarkdown(
                      editMode,
                      editor,
                      draft,
                      cardAttachmentsRef.current,
                    ))}
                    data-testid="draft-retry-sync"
                  >
                    {/* [why] "Retry Save" clarifies the user's pending action vs a background sync retry */}
                    {isSavePending ? 'Retry Save' : 'Retry'}
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
                <span className={getDraftStatusClass(draftStatus)}>
                  {isSavePending && draftStatus === 'will_sync_when_online'
                    ? 'Will save when back online'
                    : draftStatusLabel(draftStatus)}
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
