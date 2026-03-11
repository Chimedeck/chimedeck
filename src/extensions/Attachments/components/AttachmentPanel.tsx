// AttachmentPanel — full attachment section rendered inside CardDetailModal.
// Shows a header with file-picker trigger, drag-drop zone, attachment list,
// image thumbnail grid, and an "Attach a link" external URL form.
import React, { useCallback, useRef, useState } from 'react';
import { PaperClipIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';
import { listAttachments, deleteAttachment, createUrlAttachment } from '../api';
import { AttachmentDropZone } from './AttachmentDropZone';
import { AttachmentItem } from './AttachmentItem';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { PasteListener } from './PasteListener';
import type { Attachment } from '../types';
import { useEffect } from 'react';

interface Props {
  cardId: string;
}

export function AttachmentPanel({ cardId }: Props): React.ReactElement {
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

  // Find the progress for a given server attachment id (by matching attachmentId on upload entries)
  const progressForAttachment = (id: string): number | null => {
    const entry = uploads.find((u) => u.attachmentId === id && u.phase === 'uploading');
    return entry ? entry.progress : null;
  };

  return (
    <AttachmentDropZone onFiles={upload}>
      {/* Invisible paste listener — active whenever this panel is mounted */}
      <PasteListener enabled={true} onFiles={upload} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        data-testid="attachment-file-input"
      />

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <PaperClipIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
          Attachments
        </h3>
        <button
          type="button"
          onClick={handlePickerClick}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded px-2 py-1 transition-colors"
          data-testid="attach-file-button"
        >
          <PaperClipIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Attach file
        </button>
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
            type: 'FILE',
            status: 'PENDING',
            key: null,
            thumbnail_key: null,
            content_type: entry.file.type || null,
            size_bytes: entry.file.size,
            width: null,
            height: null,
            url: null,
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
        <p className="text-xs text-gray-400 italic mt-1">No attachments yet. Drop a file or click "Attach file".</p>
      )}

      <div className="space-y-0" data-testid="attachment-list">
        {attachments.map((attachment) => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            uploadProgress={progressForAttachment(attachment.id)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Thumbnail grid — image/* READY attachments */}
      {imageAttachments.length > 0 && (
        <div className="mt-3" data-testid="attachment-thumbnail-grid">
          <p className="text-xs text-gray-400 mb-2">Images</p>
          <div className="flex flex-wrap gap-2">
            {imageAttachments.map((a) => (
              <AttachmentThumbnail key={a.id} attachment={a} />
            ))}
          </div>
        </div>
      )}

      {/* External URL form */}
      <div className="mt-3">
        {showLinkForm ? (
          <form
            onSubmit={handleLinkSubmit}
            className="space-y-2"
            data-testid="link-form"
          >
            <input
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              data-testid="link-url-input"
              autoFocus
            />
            <input
              type="text"
              placeholder="Display name (optional)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              data-testid="link-name-input"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={linkSubmitting}
                className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
                data-testid="link-submit-button"
              >
                Attach
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkForm(false);
                  setLinkUrl('');
                  setLinkName('');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 rounded px-3 py-1.5 border border-gray-200 hover:border-gray-300"
              >
                Cancel
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
            Attach a link
          </button>
        )}
      </div>
    </AttachmentDropZone>
  );
}
