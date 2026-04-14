// AttachmentItem — single attachment row: type icon, name, size, status chip, progress bar,
// and delete/edit action buttons with inline confirmation and inline rename input.
import React, { useRef, useState } from 'react';
import { TrashIcon, LinkIcon, ArrowDownTrayIcon, PlayIcon, PencilIcon, ChatBubbleLeftIcon, EyeIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import IconButton from '../../../common/components/IconButton';
import type { Attachment } from '../types';
import { getMimeIcon } from '../utils/mimeIcon';
import { formatBytes } from '../utils/formatBytes';
import { UploadProgressBar } from './UploadProgressBar';
import { VideoLightbox, PdfLightbox } from './AttachmentThumbnail';
import translations from '../translations/en.json';

interface Props {
  attachment: Attachment;
  /** undefined while the file is still uploading (no server record yet) */
  uploadProgress?: number | null;
  onDelete: (id: string) => void;
  /** Called with the new alias when the user saves an inline rename. Omit for temp upload rows. */
  onRename?: (id: string, alias: string) => void;
  /**
   * Called with the pre-built markdown string `[alias ?? name](view_url)` when the user clicks
   * the Comment button. Omit to hide the button (e.g. temp upload rows or viewer guests).
   */
  onInsertComment?: (markdown: string) => void;
}

// [theme-exception] Status badge colours intentionally use semantic status colours (green/yellow/red).
const STATUS_CLASSES: Record<Attachment['status'], string> = {
  PENDING: 'bg-bg-sunken text-subtle',
  SCANNING: 'bg-yellow-900/50 text-yellow-300',
  READY: 'bg-green-900/50 text-green-300',  // [theme-exception]
  REJECTED: 'bg-red-900/50 text-red-300',  // [theme-exception]
};

const STATUS_LABELS: Record<Attachment['status'], string> = {
  PENDING: translations['attachments.item.status.uploading'],
  SCANNING: translations['attachments.item.status.scanning'],
  READY: translations['attachments.item.status.ready'],
  REJECTED: translations['attachments.item.status.rejected'],
};

export function AttachmentItem({ attachment, uploadProgress, onDelete, onRename, onInsertComment }: Readonly<Props>): React.ReactElement {
  const [confirming, setConfirming] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  // Inline rename state
  const [editing, setEditing] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Display name: alias takes precedence over original name
  const displayName = attachment.alias ?? attachment.name;

  const Icon = attachment.type === 'URL' ? LinkIcon : getMimeIcon(attachment.content_type);
  const isUploading = attachment.status === 'PENDING' && uploadProgress != null;
  const isVideo = attachment.type !== 'URL' && attachment.content_type?.startsWith('video/');
  const isPdf = attachment.type !== 'URL' && attachment.content_type === 'application/pdf';
  const openHref = attachment.type === 'URL' ? attachment.external_url : attachment.view_url;
  const canOpenWithLink = attachment.status === 'READY' && !isVideo && !isPdf && Boolean(openHref);

  const handleOpen = (): void => {
    if (isVideo) {
      setVideoOpen(true);
      return;
    }
    if (isPdf) {
      setPdfOpen(true);
      return;
    }
    // Use proxy view_url for file attachments; external_url for URL-type
    const href = attachment.type === 'URL' ? attachment.external_url : attachment.view_url;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteClick = (): void => setConfirming(true);
  const handleDeleteConfirm = (): void => {
    setConfirming(false);
    onDelete(attachment.id);
  };
  const handleDeleteCancel = (): void => setConfirming(false);

  // Begin inline rename: pre-fill with current display name and show input
  const handleEditClick = (): void => {
    setRenameValue(displayName);
    setRenameError(false);
    setEditing(true);
    // Focus input on next tick after render
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = (): void => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      // Empty value — shake input and keep open
      setRenameError(true);
      return;
    }
    setEditing(false);
    setRenameError(false);
    // Only call onRename when value actually changed
    if (trimmed !== displayName) {
      onRename?.(attachment.id, trimmed);
    }
  };

  const cancelRename = (): void => {
    setEditing(false);
    setRenameError(false);
  };

  // Build and emit the markdown link for the active comment editor
  const handleCommentClick = (): void => {
    const label = attachment.alias ?? attachment.name;
    const url = attachment.view_url ?? '';
    if (!url || !onInsertComment) return;
    onInsertComment(`[${label}](${url})`);
  };

  const handleRenameKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
    if (ev.key === 'Enter') commitRename();
    if (ev.key === 'Escape') cancelRename();
  };

  let attachmentIdentity: React.ReactNode;
  if (editing) {
    attachmentIdentity = (
      <input
        ref={renameInputRef}
        type="text"
        value={renameValue}
        onChange={(e) => { setRenameValue(e.target.value); setRenameError(false); }}
        onKeyDown={handleRenameKeyDown}
        onBlur={commitRename}
        placeholder={translations['attachment.rename.placeholder']}
        aria-label={translations['attachment.rename.placeholder']}
        className={`flex-1 min-w-0 text-sm bg-bg-overlay text-base placeholder:text-subtle border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 ${
          renameError
            ? 'border-danger focus:ring-danger animate-shake'
            : 'border-border focus:ring-primary'
        }`}
        data-testid="attachment-rename-input"
        autoFocus
      />
    );
  } else if (canOpenWithLink && openHref) {
    attachmentIdentity = (
      <a
        href={openHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2 text-link hover:underline"
        title={displayName}
      >
        <span className="flex-shrink-0 text-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-sm">{displayName}</span>
      </a>
    );
  } else {
    attachmentIdentity = (
      <div className="flex min-w-0 flex-1 items-center gap-2" title={displayName}>
        <span className="flex-shrink-0 text-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-sm text-base">{displayName}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        {/* Icon + name — linkable for ready non-video attachments */}
        {attachmentIdentity}

        {/* Size */}
        {attachment.size_bytes != null && (
          <span className="flex-shrink-0 text-xs text-muted">{formatBytes(attachment.size_bytes)}</span>
        )}

        {/* Status chip */}
        <span
          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[attachment.status]}`}
        >
          {STATUS_LABELS[attachment.status]}
        </span>

        {/* Open / Download / Play button */}
        {attachment.status === 'READY' && (() => {
          if (attachment.type === 'URL') {
            return (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpen}
                className="flex-shrink-0"
                aria-label={translations['attachments.item.action.openLink.ariaLabel']}
              >
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            );
          }
          if (isVideo) {
            return (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpen}
                className="flex-shrink-0"
                aria-label={translations['attachments.item.action.playVideo.ariaLabel']}
              >
                <PlayIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            );
          }
          if (isPdf) {
            return (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpen}
                className="flex-shrink-0"
                aria-label={translations['attachments.item.action.previewPdf.ariaLabel']}
              >
                <EyeIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            );
          }
          return (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpen}
              className="flex-shrink-0"
              aria-label={translations['attachments.item.action.downloadFile.ariaLabel']}
            >
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          );
        })()}

        {/* Edit (rename) button — only when onRename is wired and not in upload/delete mode */}
        {onRename && !confirming && !editing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEditClick}
            className="flex-shrink-0"
            aria-label={translations['attachment.item.action.edit.ariaLabel']}
            data-testid="attachment-edit-button"
          >
            <PencilIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Comment button — inserts [alias ?? name](view_url) into the active comment editor */}
        {onInsertComment && attachment.status === 'READY' && attachment.view_url && !confirming && !editing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCommentClick}
            className="flex-shrink-0"
            aria-label={translations['attachment.item.action.comment.ariaLabel']}
            data-testid="attachment-comment-button"
          >
            <ChatBubbleLeftIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Save / Cancel buttons while editing */}
        {editing && (
          <>
            <Button
              variant="link"
              size="sm"
              className="flex-shrink-0 p-0 text-xs text-blue-400 hover:text-blue-300"
              onClick={commitRename}
              aria-label={translations['attachment.rename.save']}
              data-testid="attachment-rename-save"
              // Prevent onBlur from firing before click registers
              onMouseDown={(e) => e.preventDefault()}
            >
              {translations['attachment.rename.save']}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="flex-shrink-0 p-0 text-xs text-muted hover:text-subtle"
              onClick={cancelRename}
              aria-label={translations['attachment.rename.cancel']}
              data-testid="attachment-rename-cancel"
              // Prevent onBlur from firing commit before cancel registers
              onMouseDown={(e) => e.preventDefault()}
            >
              {translations['attachment.rename.cancel']}
            </Button>
          </>
        )}

        {/* Delete button / inline confirmation */}
        {!editing && (confirming ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-subtle">{translations['attachments.item.delete.confirm']}</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-xs font-medium text-danger hover:text-danger"
              onClick={handleDeleteConfirm}
            >
              {translations['attachments.item.delete.yes']}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-xs text-muted hover:text-subtle"
              onClick={handleDeleteCancel}
            >
              {translations['attachments.item.delete.no']}
            </Button>
          </span>
        ) : (
          <IconButton
            onClick={handleDeleteClick}
            className="flex-shrink-0 text-muted hover:text-danger transition-colors"
            aria-label={translations['attachments.item.action.delete.ariaLabel']}
            icon={<TrashIcon className="h-4 w-4" aria-hidden="true" />}
            variant="ghost"
          />
        ))}
      </div>

      {/* Progress bar — only while uploading */}
      {isUploading && <UploadProgressBar progress={uploadProgress!} />}

      {/* Video player overlay — use proxy view_url */}
      {videoOpen && isVideo && attachment.view_url && (
        <VideoLightbox src={attachment.view_url} name={attachment.name} onClose={() => setVideoOpen(false)} />
      )}

      {/* PDF preview overlay — use proxy view_url */}
      {pdfOpen && isPdf && attachment.view_url && (
        <PdfLightbox src={attachment.view_url} name={attachment.name} onClose={() => setPdfOpen(false)} />
      )}
    </div>
  );
}
