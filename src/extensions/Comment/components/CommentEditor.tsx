// Rich text editor for composing or editing a comment.
// Uses Tiptap with the shared OneLineToolbar (single-line, no wrapping).
// Integrates offline draft persistence: debounce-saves on every keystroke,
// background-syncs to server when online, restores draft on card open, and
// queues the POST with an idempotency key when submitting while offline.
import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import type { Editor } from '@tiptap/react';
import type { Attachment } from '~/extensions/Attachments/types';
import InlineImage from '../extensions/InlineImage';
import { buildMentionExtension } from '~/extensions/Mention/TiptapMentionExtension';
import {
  dehydrateCommentAttachmentMarkdown,
  hasAttachmentPlaceholder,
  hydrateCommentAttachmentMarkdown,
  resolveAttachmentMarkdownUrl,
  stripCommentAttachmentPlaceholders,
} from '~/extensions/Comment/utils/attachmentMarkdown';
import { CardAssetPicker } from './CardAssetPicker';
import { useSelector } from 'react-redux';
import OneLineToolbar from '~/extensions/Card/components/OneLineToolbar';
import { useAttachmentUpload } from '~/extensions/Attachments/hooks/useAttachmentUpload';
import { listAttachments } from '~/extensions/Attachments/api';
import { InlineUploadPreview } from '~/extensions/Attachments/components/InlineUploadPreview';
import {
  useOfflineCommentDraft,
  type DraftStatus,
} from '~/extensions/OfflineDrafts/hooks/useOfflineCommentDraft';
import { selectCurrentUser, selectAccessToken } from '~/slices/authSlice';
import { selectActiveWorkspaceId } from '~/extensions/Workspace/duck/workspaceDuck';
import translations from '../translations/en.json';

interface Props {
  boardId?: string;
  cardId?: string;
  availableAttachments?: Attachment[];
  initialValue?: string;
  placeholder?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

// Map draft status to a human-readable footer label — mirrors description editor.
function draftStatusLabel(status: DraftStatus): string | null {
  switch (status) {
    case 'saving_local': return translations['comment.draft.saving'];
    case 'saved_local':  return translations['comment.draft.savedLocal'];
    case 'syncing':      return translations['comment.draft.syncing'];
    case 'synced':       return translations['comment.draft.synced'];
    case 'will_sync_when_online': return translations['comment.draft.willSync'];
    case 'sync_failed':  return translations['comment.draft.syncFailed'];
    default:             return null;
  }
}

// @tiptap/markdown may omit custom image nodes in some serialization paths.
// Ensure images in the current doc are present in the final markdown payload.
function buildCommentMarkdown(editor: Editor, attachments: Attachment[]): string {
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
    // Presence check by URL keeps this stable even if alt text changes.
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

function buildBoardProps(boardId?: string): { boardId: string } | Record<string, never> {
  return boardId ? { boardId } : {};
}

function getDraftStatusClass(status: DraftStatus): string {
  if (status === 'will_sync_when_online') return 'text-amber-500 dark:text-amber-400';
  if (status === 'synced') return 'text-green-500 dark:text-green-400';
  return 'text-gray-400 dark:text-slate-500';
}

function normalizeEscapedBlockquoteMarkers(markdown: string): string {
  return markdown
    .replaceAll(/^(\s*)&gt;(?=\s|$)/gm, '$1>')
    .replaceAll(/^(\s*)&amp;gt;(?=\s|$)/gm, '$1>');
}

function resolvePendingHydratedContent(pendingContent: string | null, attachments: Attachment[]): string | null {
  if (!pendingContent) return null;
  const normalized = normalizeEscapedBlockquoteMarkers(pendingContent);
  if (hasAttachmentPlaceholder(normalized) && attachments.length === 0) return null;
  return hydrateCommentAttachmentMarkdown(normalized, attachments);
}

function getInitialEditorContent(initialValue: string, attachments: Attachment[]): string {
  const normalized = normalizeEscapedBlockquoteMarkers(initialValue);
  if (hasAttachmentPlaceholder(normalized) && attachments.length === 0) {
    return stripCommentAttachmentPlaceholders(normalized);
  }
  return hydrateCommentAttachmentMarkdown(normalized, attachments);
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

  const snippet = buildAttachmentSnippet({
    name: attachment.name,
    url,
    isImage,
  });
  insertSnippetAt(editor, pos, snippet);
  return true;
}

const CommentEditor = ({
  boardId,
  cardId,
  availableAttachments = [],
  initialValue = '',
  placeholder = translations['comment.editor.placeholder'],
  onSubmit,
  onCancel,
  submitLabel = translations['comment.editor.submit'],
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [cardAttachments, setCardAttachments] = useState<Attachment[]>(availableAttachments);

  // Auth + workspace context needed by the offline draft hook
  const currentUser = useSelector(selectCurrentUser);
  const token = useSelector(selectAccessToken) ?? undefined;
  const workspaceId = useSelector(selectActiveWorkspaceId) ?? undefined;

  // File picker ref for attachment uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  // [why] Track the editor position at the moment each upload was initiated so the
  // completed image/link can be inserted at the right cursor location, even when
  // the user kept typing while the upload was in-flight.
  const insertPosMap = useRef<Map<string, number>>(new Map());
  // [why] Refs break the circular dep: useAttachmentUpload onSuccess needs the editor,
  // and useEditor handleDrop needs uploadFiles. Refs are updated each render so
  // async callbacks always read the latest instance without stale-closure issues.
  const editorRef = useRef<Editor | null>(null);
  const uploadFilesRef = useRef<((files: File[]) => string[]) | null>(null);
  const cardAttachmentsRef = useRef<Attachment[]>(availableAttachments);
  const pendingHydratedContentRef = useRef<string | null>(initialValue || null);
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

  useEffect(() => {
    replaceCardAttachments(availableAttachments);
  }, [availableAttachments, replaceCardAttachments]);

  // Attachment upload — only active when a cardId is provided.
  // [why] deferred=true keeps uploads queueable, while explicit flushes let us
  // upload immediately from picker/file-input flows when needed.
  const { uploads, upload: uploadFiles, removeEntry, flush: flushUploads } = useAttachmentUpload({
    cardId: cardId ?? '',
    deferred: true,
    onSuccess(attachment: Attachment, clientId: string) {
      // Prepend the newly uploaded attachment so it appears immediately in the picker
      prependCardAttachment(attachment);
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      const savedPos = insertPosMap.current.get(clientId);
      insertPosMap.current.delete(clientId);
      const docSize = ed.state.doc.content.size;
      // Clamp to valid range in case the document shrank while uploading
      const insertAt = savedPos === undefined ? ed.state.selection.anchor : Math.min(savedPos, docSize);
      if (insertAttachmentAt(ed, attachment, insertAt)) return;
      // [why] Fresh upload responses can temporarily miss usable URLs for images.
      // Retry once the next attachment list fetch hydrates those URLs.
      pendingAttachmentInsertRef.current.set(attachment.id, insertAt);
    },
  });
  // Keep the ref current so the async onSuccess always reads the live editor
  uploadFilesRef.current = uploadFiles;

  // Load card attachments once (and refresh after a new upload succeeds)
  const loadCardAttachments = useCallback(async () => {
    if (!cardId) return;
    try {
      const res = await listAttachments({ cardId });
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      replaceCardAttachments(sorted);
    } catch {
      // non-critical — picker will show empty list
    }
  }, [cardId, replaceCardAttachments]);

  useEffect(() => {
    void loadCardAttachments();
  }, [loadCardAttachments]);

  // Keep picker data fresh when opening so it reflects uploads made elsewhere in the card.
  useEffect(() => {
    if (!assetPickerOpen) return;
    void loadCardAttachments();
  }, [assetPickerOpen, loadCardAttachments]);

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
    extensions: [
      StarterKit,
      Markdown,
      // [why] InlineImage now includes markdown parse/render support.
      InlineImage,
      // [why] Mention extension auto-loads for boards; skip if no boardId (edge case).
      ...(boardId ? [buildMentionExtension(boardId)] : []),
    ],
    content: getInitialEditorContent(initialValue || '', cardAttachmentsRef.current),
    contentType: 'markdown',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      notifyDraftChange(buildCommentMarkdown(editor, cardAttachmentsRef.current));
    },
    editorProps: {
      // [why] Apply prose classes directly on ProseMirror so Tailwind Typography
      // descendant selectors (.prose ul, .prose blockquote, etc.) work correctly.
      // Using [&_.ProseMirror]:prose variant only applies the root .prose properties,
      // not the child-element selectors that list/blockquote/heading styling depends on.
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none outline-none text-gray-900 dark:text-slate-100',
      },
      // [why] Intercept file drops directly onto the editor so images dropped
      // anywhere in the text area are uploaded and inserted at the drop position.
      handleDrop(view, event, _slice, moved) {
        if (moved || !event.dataTransfer) return false;
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos ?? view.state.doc.content.size;
        // [why] Read from ref so this closure always calls the current uploadFiles
        // even though handleDrop was created before uploadFiles was first assigned.
        const ids = uploadFilesRef.current?.(files) ?? [];
        ids.forEach((id) => insertPosMap.current.set(id, pos));
        return true;
      },
    },
  });
  // Keep editorRef current so the async onSuccess always reads the live editor
  editorRef.current = editor;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const hydratedContent = resolvePendingHydratedContent(
      pendingHydratedContentRef.current,
      cardAttachmentsRef.current,
    );
    if (!hydratedContent) return;
    editor.commands.setContent(hydratedContent, { contentType: 'markdown' });
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

  // Restore offline draft into editor once it's loaded (async, after initial render)
  useEffect(() => {
    if (!restoredDraft) return;
    pendingHydratedContentRef.current = restoredDraft;
  // [why] Only restore when the draft first becomes available — not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredDraft]);

  const handleSubmit = useCallback(async () => {
    if (!editor) return;
    const trimmed = buildCommentMarkdown(editor, cardAttachmentsRef.current).trim();
    if (!trimmed) {
      setError(translations['comment.editor.error.empty']);
      return;
    }
    setError(null);

    // Offline path: queue POST and show "Will post when back online"
    const handledOffline = handleSubmitIntent(trimmed);
    if (handledOffline) return;

    // Online path: flush any queued (deferred) attachments first, then submit.
    setSubmitting(true);
    try {
      // [why] Deferred uploads haven't started yet — flush() triggers them all and
      // waits for completion so onSuccess inserts the attachment URLs into the editor
      // before we read the final markdown to post.
      await flushUploads();
      await onSubmit(buildCommentMarkdown(editor, cardAttachmentsRef.current).trim());
      editor.commands.clearContent();
      clearDraft();
    } catch {
      setError(translations['comment.editor.error.saveFailed']);
    } finally {
      setSubmitting(false);
    }
  }, [editor, onSubmit, handleSubmitIntent, clearDraft, flushUploads]);

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

  // Toggle the asset picker (file upload + existing card assets)
  const handleAttach = useCallback(() => {
    if (!cardId) return;
    // Focus editor to lock in the cursor position before the picker opens
    if (editor && !editor.isDestroyed) {
      editor.commands.focus();
    }
    setAssetPickerOpen((prev) => !prev);
  }, [cardId, editor]);

  // Insert an existing card attachment at the current cursor position
  const handleInsertExisting = useCallback(
    (attachment: Attachment) => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      insertAttachmentAt(ed, attachment, ed.state.selection.anchor);
    },
    [],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        const pos = editor && !editor.isDestroyed
          ? editor.state.selection.anchor
          : 0;
        const ids = uploadFiles(files);
        ids.forEach((id) => insertPosMap.current.set(id, pos));

        // Start deferred uploads right away so newly uploaded files show up in
        // the insert-attachment picker without waiting for comment submit.
        void flushUploads()
          .then(() => loadCardAttachments())
          .catch(() => setError(translations['comment.editor.error.uploadFailed']));
      }
      e.target.value = '';
    },
    [editor, uploadFiles, flushUploads, loadCardAttachments],
  );

  const currentMarkdown = editor ? buildCommentMarkdown(editor, cardAttachmentsRef.current) : '';

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
              ? translations['comment.draft.unsavedOffline']
              : translations['comment.draft.unsaved']}
          </span>
          <button
            type="button"
            className="ml-4 text-gray-400 hover:text-gray-300 underline transition-colors"
            onClick={discardDraft}
            data-testid="comment-draft-discard"
          >
            {translations['comment.draft.discard']}
          </button>
        </div>
      )}

      <div
        className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-visible focus-within:ring-2 focus-within:ring-blue-400"
        onKeyDown={handleKeyDown}
      >
        {/* Single-line toolbar — never wraps */}
        {/* [why] relative wrapper anchors the CardAssetPicker popover to the toolbar row */}
        <div className="relative">
          <OneLineToolbar
            editor={editor}
            overflowOpen={overflowOpen}
            onToggleOverflow={() => setOverflowOpen((o) => !o)}
            {...(cardId ? { onAttach: handleAttach } : {})}
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
        <EditorContent
          editor={editor}
          aria-label={translations['comment.editor.ariaLabel']}
          aria-placeholder={placeholder}
          className="px-3 py-2 text-sm [&_.ProseMirror]:min-h-[72px] [&_.ProseMirror>*:first-child]:mt-0 [&_.ProseMirror>*:last-child]:mb-0"
        />

        {/* Inline upload previews — shown while files are in-flight */}
        {uploads.length > 0 && (
          <div
            aria-label={translations['comment.editor.uploads.ariaLabel']}
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
                {isSubmitPending ? translations['comment.draft.postFailed'] : translations['comment.draft.syncFailed']}
              </span>
              <button
                type="button"
                className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                onClick={() => retrySync(currentMarkdown)}
                data-testid="comment-draft-retry-sync"
              >
                {/* [why] "Retry Post" clarifies the user's pending action vs a background sync retry */}
                {isSubmitPending ? translations['comment.draft.retryPost'] : translations['comment.draft.retry']}
              </button>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-300 underline transition-colors"
                onClick={discardDraft}
                data-testid="comment-draft-discard-footer"
              >
                {translations['comment.draft.discardFooter']}
              </button>
            </>
          ) : (
            <span className={getDraftStatusClass(draftStatus)}>
              {isSubmitPending && draftStatus === 'will_sync_when_online'
                ? translations['comment.draft.willSync']
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
          {submitting ? translations['comment.editor.submitting'] : submitLabel}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="rounded px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            {translations['comment.editor.cancel']}
          </button>
        )}
      </div>
    </div>
  );
};

export default CommentEditor;

