// AttachmentPanel — full attachment section rendered inside CardDetailModal.
// Shows a header with file-picker trigger, drag-drop zone, attachment list,
// image thumbnail grid, and an "Attach a link" external URL form.
import React, { useCallback, useRef, useState } from 'react';
import { PaperClipIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';
import { listAttachments, deleteAttachment, createUrlAttachment, patchAttachment } from '../api';
import { AttachmentDropZone } from './AttachmentDropZone';
import { AttachmentItem } from './AttachmentItem';
import { AttachmentThumbnail, VideoThumbnail } from './AttachmentThumbnail';
import { PasteListener } from './PasteListener';
import type { Attachment } from '../types';
import { useEffect } from 'react';
import translations from '../translations/en.json';

interface Props {
  cardId: string;
  /** False when the current user is a VIEWER guest — hides upload/attach controls. Defaults to true. */
  canWrite?: boolean;
  /**
   * Ref populated by ActivityFeed/CommentEditor with a function that inserts markdown
   * at the current cursor position. When provided, each AttachmentItem shows a Comment
   * button that calls `insertMarkdownRef.current(md)` with the formatted link.
   */
  insertMarkdownRef?: React.MutableRefObject<((md: string) => void) | null>;
}

export function AttachmentPanel({ cardId, canWrite = true, insertMarkdownRef }: Props): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Server-persisted attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // URL-attachment form state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // Load attachments from the server
  const loadAttachments = useCallback(async () => {
    try {
      const res = await listAttachments({ cardId });
      // Sort newest-first
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setAttachments(sorted);
    } catch {
      setLoadError('Failed to load attachments');
    }
  }, [cardId]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  // Upload hook — refreshes the server list when a new upload completes
  const { uploads, upload, removeEntry } = useAttachmentUpload({
    cardId,
    onSuccess: () => {
      void loadAttachments();
    },
  });

  // Delete attachment with optimistic removal
  const handleDelete = useCallback(
    async (id: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      try {
        await deleteAttachment({ cardId, attachmentId: id });
      } catch {
        // Roll back on failure
        void loadAttachments();
      }
    },
    [cardId, loadAttachments],
  );

  // Rename attachment — optimistic alias update, rolls back on server error
  const handleRename = useCallback(
    async (id: string, alias: string) => {
      // Optimistic update
      setAttachments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, alias } : a)),
      );
      try {
        const res = await patchAttachment({ attachmentId: id, alias });
        // Sync with confirmed server value
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? res.data : a)),
        );
      } catch {
        // Roll back optimistic update on failure
        void loadAttachments();
      }
    },
    [loadAttachments],
  );

  // Insert markdown link into the active comment editor — no network call
  const handleInsertComment = useCallback(
    (markdown: string) => {
      insertMarkdownRef?.current?.(markdown);
    },
    [insertMarkdownRef],
  );

  // Open native file picker
  const handlePickerClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(ev.target.files ?? []);
    if (files.length > 0) upload(files);
    // Reset input so the same file can be picked again
    ev.target.value = '';
  };

  // External URL form submit
  const handleLinkSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    if (!linkUrl.trim()) return;
    setLinkSubmitting(true);
    try {
      const res = await createUrlAttachment({
        cardId,
        url: linkUrl.trim(),
        name: linkName.trim() || linkUrl.trim(),
      });
      setAttachments((prev) => [res.data, ...prev]);
      setLinkUrl('');
      setLinkName('');
      setShowLinkForm(false);
    } catch {
      // keep form open so user can retry
    } finally {
      setLinkSubmitting(false);
    }
  };

  // Separate image attachments (READY + image/* content_type) for thumbnail grid
  const imageAttachments = attachments.filter(
    (a) => a.status === 'READY' && a.content_type?.startsWith('image/'),
  );

  // Separate video attachments (READY + video/* content_type) for thumbnail grid
  const videoAttachments = attachments.filter(
    (a) => a.status === 'READY' && a.content_type?.startsWith('video/'),
  );

  // Find the progress for a given server attachment id (by matching attachmentId on upload entries)
  const progressForAttachment = (id: string): number | null => {
    const entry = uploads.find((u) => u.attachmentId === id && u.phase === 'uploading');
    return entry ? entry.progress : null;
  };

  return (
    <AttachmentDropZone onFiles={canWrite ? upload : () => {}}>
      {/* Invisible paste listener — only active when the user can write */}
      <PasteListener enabled={canWrite} onFiles={upload} />

      {/* Hidden file input — accept covers all server-allowed types; server re-validates */}
      {canWrite && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,text/markdown,application/zip,application/x-tar,application/gzip,audio/*"
          className="hidden"
          onChange={handleFileInputChange}
          data-testid="attachment-file-input"
        />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
          <PaperClipIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {translations['attachments.panel.title']}
        </h3>
        {canWrite && (
          <button
            type="button"
            onClick={handlePickerClick}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-400 rounded px-2 py-1 transition-colors"
            data-testid="attach-file-button"
          >
            <PaperClipIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {translations['attachments.panel.attachFile']}
          </button>
        )}
      </div>

      {/* In-flight uploads (before server record exists) */}
      {uploads
        .filter((u) => u.phase !== 'done')
        .map((entry) => {
          // Render a temporary row using the file details
          const tempAttachment: Attachment = {
            id: entry.clientId,
            card_id: cardId,
            name: entry.file.name,
            alias: null,
            type: 'FILE',
            status: 'PENDING',
            key: null,
            thumbnail_key: null,
            content_type: entry.file.type || null,
            size_bytes: entry.file.size,
            width: null,
            height: null,
            view_url: null,
            thumbnail_url: null,
            external_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          return (
            <AttachmentItem
              key={entry.clientId}
              attachment={tempAttachment}
              uploadProgress={entry.phase === 'uploading' ? entry.progress : null}
              onDelete={() => removeEntry(entry.clientId)}
            />
          );
        })}

      {/* Server-persisted attachment list */}
      {loadError && (
        <p className="text-xs text-red-500 mt-1">{loadError}</p>
      )}

      {attachments.length === 0 && uploads.filter((u) => u.phase !== 'done').length === 0 && (
        <p className="text-xs text-slate-500 italic mt-1">{translations['attachments.panel.empty']}</p>
      )}

      <div className="space-y-0" data-testid="attachment-list">
        {attachments.map((attachment) => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            uploadProgress={progressForAttachment(attachment.id)}
            onDelete={handleDelete}
            onRename={handleRename}
            {...(insertMarkdownRef ? { onInsertComment: handleInsertComment } : {})}
          />
        ))}
      </div>

      {/* Thumbnail grid — image/* READY attachments */}
      {imageAttachments.length > 0 && (
        <div className="mt-3" data-testid="attachment-thumbnail-grid">
          <p className="text-xs text-slate-400 mb-2">{translations['attachments.panel.imagesSection']}</p>
          <div className="flex flex-wrap gap-2">
            {imageAttachments.map((a) => (
              <AttachmentThumbnail key={a.id} attachment={a} />
            ))}
          </div>
        </div>
      )}

      {/* Thumbnail grid — video/* READY attachments */}
      {videoAttachments.length > 0 && (
        <div className="mt-3" data-testid="attachment-video-grid">
          <p className="text-xs text-slate-400 mb-2">{translations['attachments.panel.videosSection']}</p>
          <div className="flex flex-wrap gap-2">
            {videoAttachments.map((a) => (
              <VideoThumbnail key={a.id} attachment={a} />
            ))}
          </div>
        </div>
      )}

      {/* External URL form — hidden for VIEWER guests */}
      {canWrite && (
        <div className="mt-3">
          {showLinkForm ? (
            <form
              onSubmit={handleLinkSubmit}
              className="space-y-2"
              data-testid="link-form"
            >
              <input
                type="url"
                placeholder={translations['attachments.panel.link.urlPlaceholder']}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                required
                className="w-full text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="link-url-input"
                autoFocus
              />
              <input
                type="text"
                placeholder={translations['attachments.panel.link.namePlaceholder']}
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="w-full text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="link-name-input"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={linkSubmitting}
                  className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
                  data-testid="link-submit-button"
                >
                  {translations['attachments.panel.link.attach']}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkForm(false);
                    setLinkUrl('');
                    setLinkName('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 rounded px-3 py-1.5 border border-slate-600 hover:border-slate-400"
                >
                  {translations['attachments.panel.link.cancel']}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowLinkForm(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              data-testid="attach-link-button"
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {translations['attachments.panel.link.attachLink']}
            </button>
          )}
        </div>
      )}
    </AttachmentDropZone>
  );
}
