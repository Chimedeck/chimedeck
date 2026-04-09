// AttachmentPanel — full attachment section rendered inside CardDetailModal.
// Shows a header with file-picker trigger, drag-drop zone, attachment list,
// image thumbnail grid, and an "Attach a link" external URL form.
// Internal card links are shown in a "Cards" section (card preview).
// External links are shown in a separate "Links" section.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PaperClipIcon, LinkIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';
import { listAttachments, deleteAttachment, createUrlAttachment, patchAttachment, fetchCardPreview } from '../api';
import { AttachmentDropZone } from './AttachmentDropZone';
import { AttachmentItem } from './AttachmentItem';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { CardAttachmentPreview } from './CardAttachmentPreview';
import { ExternalLinkPreview } from './ExternalLinkPreview';
import { PasteListener } from './PasteListener';
import type { Attachment, CardPreview } from '../types';
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
  /** Called whenever the persisted attachment count changes (add, delete, or initial load). */
  onCountChange?: (counts: { fileCount: number; linkedCardCount: number }) => void;
}

export function AttachmentPanel({ cardId, canWrite = true, insertMarkdownRef, onCountChange }: Props): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Server-persisted attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // URL-attachment form state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  // Card detection — live preview when an internal card URL is pasted
  const [detectedCard, setDetectedCard] = useState<CardPreview | null>(null);
  const [detectingCard, setDetectingCard] = useState(false);
  const [detectError, setDetectError] = useState(false);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load attachments from the server
  const loadAttachments = useCallback(async () => {
    try {
      const res = await listAttachments({ cardId });
      // Sort newest-first
      const sorted = [...res.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setAttachments(sorted);
      const fileCount = sorted.filter((a) => a.referenced_card_id == null).length;
      const linkedCardCount = sorted.filter((a) => a.referenced_card_id != null).length;
      onCountChange?.({ fileCount, linkedCardCount });
    } catch {
      setLoadError('Failed to load attachments');
    }
  }, [cardId, onCountChange]);

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
      setAttachments((prev) => {
        const next = prev.filter((a) => a.id !== id);
        const fileCount = next.filter((a) => a.referenced_card_id == null).length;
        const linkedCardCount = next.filter((a) => a.referenced_card_id != null).length;
        onCountChange?.({ fileCount, linkedCardCount });
        return next;
      });
      try {
        await deleteAttachment({ cardId, attachmentId: id });
      } catch {
        // Roll back on failure
        void loadAttachments();
      }
    },
    [cardId, loadAttachments, onCountChange],
  );

  // Handle a URL pasted anywhere in the card modal while no text input is focused.
  // Immediately creates a link attachment — internal card links are resolved first
  // to use the card title as the display name.
  const handlePasteLink = useCallback(
    async (url: string): Promise<void> => {
      if (!canWrite) return;
      const internal = parseInternalCardUrl(url);
      let name = url;
      if (internal) {
        try {
          const res = await fetchCardPreview({ cardId: internal.cardId });
          name = res.data.title;
        } catch {
          // fall back to URL as name
        }
      }
      try {
        await createUrlAttachment({ cardId, url, name });
        void loadAttachments();
      } catch {
        // silently ignore — user can still use the manual link form
      }
    },
    [cardId, canWrite, loadAttachments],
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

  // Parse an internal card URL — same logic as the server-side parseInternalCardUrl.
  // Returns { cardId } only when the URL is on the same origin as the current page.
  const parseInternalCardUrl = (url: string): { cardId: string } | null => {
    try {
      const parsed = new URL(url);
      // [why] Only URLs on this origin are internal — guard against cross-site links.
      if (parsed.origin !== globalThis.location.origin) return null;
      const match = /^\/boards\/([^/]+)$/.exec(parsed.pathname);
      if (!match) return null;
      const cardId = parsed.searchParams.get('card');
      if (!cardId) return null;
      return { cardId };
    } catch {
      return null;
    }
  };

  // Debounced URL detection — fires 400 ms after the user stops typing.
  const handleLinkUrlChange = (value: string): void => {
    setLinkUrl(value);
    // Reset detection state immediately when URL changes
    setDetectedCard(null);
    setDetectError(false);
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);

    const internal = parseInternalCardUrl(value.trim());
    if (!internal) return;

    setDetectingCard(true);
    detectTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetchCardPreview({ cardId: internal.cardId });
        const card: CardPreview = {
          id: res.data.id,
          title: res.data.title,
          board_id: res.includes.board.id,
          board_name: res.includes.board.title,
          list_id: res.includes.list.id,
          list_name: res.includes.list.title,
          labels: res.includes.labels,
        };
        setDetectedCard(card);
        // Auto-fill name with card title if user hasn't typed a custom name
        setLinkName((prev) => (prev.trim() === '' ? card.title : prev));
      } catch {
        setDetectError(true);
      } finally {
        setDetectingCard(false);
      }
    }, 400);
  };

  // External URL form submit
  const handleLinkSubmit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    if (!linkUrl.trim()) return;
    setLinkSubmitting(true);
    try {
      // [why] For internal card links the name is auto-filled from the card title;
      // fall back to the URL string only for external links with no display name.
      const nameToSend = linkName.trim() || detectedCard?.title || linkUrl.trim();
      await createUrlAttachment({
        cardId,
        url: linkUrl.trim(),
        name: nameToSend,
      });
      void loadAttachments();
      setLinkUrl('');
      setLinkName('');
      setDetectedCard(null);
      setDetectError(false);
      setShowLinkForm(false);
    } catch {
      // keep form open so user can retry
    } finally {
      setLinkSubmitting(false);
    }
  };

  // Separate image attachments (READY + image/* content_type) for thumbnail grid
  // Partition server attachments by kind.
  // Card links: URL attachments that reference an internal card.
  const cardLinkAttachments = attachments.filter(
    (a) => a.type === 'URL' && a.referenced_card_id,
  );
  // External links: URL attachments that are pure external URLs.
  const externalLinkAttachments = attachments.filter(
    (a) => a.type === 'URL' && !a.referenced_card_id,
  );
  // Files: all FILE-type attachments.
  const fileAttachments = attachments.filter((a) => a.type === 'FILE');

  const imageAttachments = fileAttachments.filter(
    (a) => a.status === 'READY' && a.content_type?.startsWith('image/'),
  );

  // Find the progress for a given server attachment id (by matching attachmentId on upload entries)
  const progressForAttachment = (id: string): number | null => {
    const entry = uploads.find((u) => u.attachmentId === id && u.phase === 'uploading');
    return entry ? entry.progress : null;
  };

  return (
    <AttachmentDropZone
      onFiles={canWrite ? upload : () => {}}
      scope="both"
      activeWithinSelector="[data-card-modal-content='true']"
      excludeSelectors={[
        "[data-upload-drop-exclude='true']",
        "[data-attachment-dropzone-root='true']",
      ]}
    >
      {/* Invisible paste listener — only active when the user can write */}
      <PasteListener enabled={canWrite} onFiles={upload} onLink={handlePasteLink} />

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
        <h3 className="text-sm font-semibold text-subtle flex items-center gap-1.5">
          <PaperClipIcon className="h-4 w-4 text-muted" aria-hidden="true" />
          {translations['attachments.panel.title']}
        </h3>
        {canWrite && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={handlePickerClick}
            data-testid="attach-file-button"
          >
            <PaperClipIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {translations['attachments.panel.attachFile']}
          </Button>
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
            referenced_card_id: null,
            referenced_card: null,
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
        <p className="text-xs text-danger mt-1">{loadError}</p>
      )}

      {attachments.length === 0 && uploads.filter((u) => u.phase !== 'done').length === 0 && (
        <p className="text-xs text-muted italic mt-1">{translations['attachments.panel.empty']}</p>
      )}

      {/* FILE attachments */}
      <div className="space-y-0" data-testid="attachment-list">
        {fileAttachments.map((attachment) => (
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
          <p className="text-xs text-muted mb-2">{translations['attachments.panel.imagesSection']}</p>
          <div className="flex flex-wrap gap-2">
            {imageAttachments.map((a) => (
              <AttachmentThumbnail key={a.id} attachment={a} />
            ))}
          </div>
        </div>
      )}

      {/* Cards section — internal card-link attachments */}
      {cardLinkAttachments.length > 0 && (
        <div className="mt-4" data-testid="card-attachments-section">
          <p className="text-xs font-semibold text-muted mb-2">
            {translations['attachments.panel.cardsSection']}
          </p>
          <div className="flex flex-wrap gap-2">
            {cardLinkAttachments.map((attachment) =>
              attachment.referenced_card ? (
                <CardAttachmentPreview
                  key={attachment.id}
                  attachmentId={attachment.id}
                  card={attachment.referenced_card}
                  cardUrl={attachment.view_url ?? attachment.external_url ?? ''}
                  canWrite={canWrite}
                  onDelete={handleDelete}
                />
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Links section — external URL attachments */}
      {externalLinkAttachments.length > 0 && (
        <div className="mt-4" data-testid="link-attachments-section">
          <p className="text-xs font-semibold text-muted mb-2">
            {translations['attachments.panel.linksSection']}
          </p>
          <div className="space-y-2">
            {externalLinkAttachments.map((attachment) => (
              <ExternalLinkPreview
                key={attachment.id}
                attachment={attachment}
                canWrite={canWrite}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Video attachments do not show previews — they are listed in the attachment list above. */}

      {/* External URL / card link form — hidden for VIEWER guests */}
      {canWrite && (
        <div className="mt-3 pb-4">
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
                onChange={(e) => handleLinkUrlChange(e.target.value)}
                required
                className="w-full text-sm bg-bg-overlay text-base placeholder:text-subtle border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="link-url-input"
                autoFocus
              />

              {/* Internal card preview — shown when URL resolves to a card in this workspace */}
              {detectingCard && (
                <p className="text-xs text-muted italic">{translations['attachments.panel.link.loadingCard']}</p>
              )}
              {detectError && !detectingCard && (
                <p className="text-xs text-amber-400">{translations['attachments.panel.link.cardNotFound']}</p>
              )}
              {detectedCard && !detectingCard && (
                <div className="rounded-lg border border-border bg-bg-surface/60 px-3 py-2" data-testid="link-card-preview">
                  <p className="text-[11px] text-muted truncate mb-0.5">
                    {detectedCard.board_name ?? ''}
                    {detectedCard.list_name ? <span className="ml-1 text-muted">· {detectedCard.list_name}</span> : null}
                  </p>
                  {detectedCard.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {detectedCard.labels.map((label) => (
                        <span
                          key={label.id}
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-white/90 truncate max-w-[120px]" // [theme-exception] text-white on colored attachment thumbnail
                          style={{ backgroundColor: label.color }}
                          title={label.name}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm font-medium text-base truncate">{detectedCard.title}</p>
                </div>
              )}

              {/* Name field — hidden when a card was detected (card title is used automatically) */}
              {!detectedCard && (
                <input
                  type="text"
                  placeholder={translations['attachments.panel.link.namePlaceholder']}
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  className="w-full text-sm bg-bg-overlay text-base placeholder:text-subtle border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="link-name-input"
                />
              )}

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={linkSubmitting || detectingCard}
                  data-testid="link-submit-button"
                >
                  {translations['attachments.panel.link.attach']}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setShowLinkForm(false);
                    setLinkUrl('');
                    setLinkName('');
                    setDetectedCard(null);
                    setDetectError(false);
                  }}
                >
                  {translations['attachments.panel.link.cancel']}
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowLinkForm(true)}
              className="flex items-center gap-1 text-xs text-muted hover:text-subtle transition-colors"
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
