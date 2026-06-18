// AttachmentItem — single attachment row: type icon, name, size, status chip, progress bar,
// and delete/edit action buttons with inline confirmation and inline rename input.
import React, { useRef, useState } from 'react';
import {
  TrashIcon,
  LinkIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  PencilIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import IconButton from '../../../common/components/IconButton';
import type { Attachment } from '../types';
import { getMimeIcon } from '../utils/mimeIcon';
import { formatBytes } from '../utils/formatBytes';
import { UploadProgressBar } from './UploadProgressBar';
import { ImageLightbox, VideoLightbox, PdfLightbox } from './AttachmentThumbnail';
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
  READY: 'bg-green-900/50 text-green-300', // [theme-exception]
  REJECTED: 'bg-red-900/50 text-red-300', // [theme-exception]
};

const STATUS_LABELS: Record<Attachment['status'], string> = {
  PENDING: translations['attachments.item.status.uploading'],
  SCANNING: translations['attachments.item.status.scanning'],
  READY: translations['attachments.item.status.ready'],
  REJECTED: translations['attachments.item.status.rejected'],
};

function formatAttachedMeta(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - created.getTime()) / 1000));
  const timeLabel = created.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (diffSeconds >= 86400) {
    const dateLabel = created.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `Added ${dateLabel} at ${timeLabel}`;
  }

  let relative = 'just now';
  if (diffSeconds >= 3600) {
    const hours = Math.floor(diffSeconds / 3600);
    relative = `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else if (diffSeconds >= 60) {
    const minutes = Math.floor(diffSeconds / 60);
    relative = `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  return `Added ${relative} at ${timeLabel}`;
}

function openAttachmentTarget({
  isVideo,
  isImage,
  isPdf,
  attachment,
  setVideoOpen,
  setImageOpen,
  setPdfOpen,
}: {
  isVideo: boolean;
  isImage: boolean;
  isPdf: boolean;
  attachment: Attachment;
  setVideoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setImageOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPdfOpen: React.Dispatch<React.SetStateAction<boolean>>;
}): void {
  if (isVideo) {
    setVideoOpen(true);
    return;
  }
  if (isImage) {
    setImageOpen(true);
    return;
  }
  if (isPdf) {
    setPdfOpen(true);
    return;
  }

  // Use proxy view_url for file attachments; external_url for URL-type.
  const href = attachment.type === 'URL' ? attachment.external_url : attachment.view_url;
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
}

function renderOpenActionButton({
  attachment,
  isVideo,
  isPdf,
  handleOpen,
}: {
  attachment: Attachment;
  isVideo: boolean;
  isPdf: boolean;
  handleOpen: () => void;
}): React.ReactNode {
  if (attachment.status !== 'READY') return null;

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
}

function renderAttachmentIdentity({
  editing,
  renameInputRef,
  renameValue,
  setRenameValue,
  setRenameError,
  handleRenameKeyDown,
  commitRename,
  displayName,
  canOpenWithLink,
  openHref,
  leadingVisual,
  attachedMeta,
  attachment,
  handleOpen,
  renameError,
  nameClassName,
}: {
  editing: boolean;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  renameValue: string;
  setRenameValue: React.Dispatch<React.SetStateAction<string>>;
  setRenameError: React.Dispatch<React.SetStateAction<boolean>>;
  handleRenameKeyDown: (ev: React.KeyboardEvent<HTMLInputElement>) => void;
  commitRename: () => void;
  displayName: string;
  canOpenWithLink: boolean;
  openHref: string | null;
  leadingVisual: React.ReactNode;
  attachedMeta: string;
  attachment: Attachment;
  handleOpen: () => void;
  renameError: boolean;
  nameClassName: string;
}): React.ReactNode {
  if (editing) {
    return (
      <input
        ref={renameInputRef}
        type="text"
        value={renameValue}
        onChange={(e) => {
          setRenameValue(e.target.value);
          setRenameError(false);
        }}
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
  }

  const content = (
    <>
      {leadingVisual}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${nameClassName}`}>{displayName}</span>
        {attachedMeta && <span className="block text-xs text-muted">{attachedMeta}</span>}
      </span>
    </>
  );

  if (canOpenWithLink && openHref) {
    return (
      <a
        href={openHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2"
        title={displayName}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="flex min-w-0 flex-1 items-center gap-2 text-left"
      title={displayName}
      onClick={attachment.status === 'READY' ? handleOpen : undefined}
    >
      {content}
    </button>
  );
}

export function AttachmentItem({
  attachment,
  uploadProgress,
  onDelete,
  onRename,
  onInsertComment,
}: Readonly<Props>): React.ReactElement {
  const [confirming, setConfirming] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
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
  const attachedMeta = formatAttachedMeta(attachment.created_at);
  const isUploading = attachment.status === 'PENDING' && uploadProgress != null;
  const isVideo = attachment.type !== 'URL' && attachment.content_type?.startsWith('video/');
  const isPdf = attachment.type !== 'URL' && attachment.content_type === 'application/pdf';
  const isImage =
    attachment.type !== 'URL' && Boolean(attachment.content_type?.startsWith('image/'));
  const openHref = attachment.type === 'URL' ? attachment.external_url : attachment.view_url;
  const canOpenWithLink =
    attachment.status === 'READY' && !isImage && !isVideo && !isPdf && Boolean(openHref);
  const imagePreviewSrc = attachment.thumbnail_url ?? attachment.view_url;

  const handleOpen = (): void => {
    openAttachmentTarget({
      isVideo,
      isImage,
      isPdf,
      attachment,
      setVideoOpen,
      setImageOpen,
      setPdfOpen,
    });
  };

  const handleDeleteClick = (): void => {
    setConfirming(true);
  };
  const handleDeleteConfirm = (): void => {
    setConfirming(false);
    onDelete(attachment.id);
  };
  const handleDeleteCancel = (): void => {
    setConfirming(false);
  };

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

  const leadingVisual =
    isImage && imagePreviewSrc ? (
      <span className="flex h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border border-border bg-bg-overlay">
        <img
          src={imagePreviewSrc}
          alt={attachment.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </span>
    ) : (
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-border bg-bg-overlay text-muted">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    );

  const attachmentIdentity = renderAttachmentIdentity({
    editing,
    renameInputRef,
    renameValue,
    setRenameValue,
    setRenameError,
    handleRenameKeyDown,
    commitRename,
    displayName,
    canOpenWithLink,
    openHref,
    leadingVisual,
    attachedMeta,
    attachment,
    handleOpen,
    renameError,
    nameClassName: canOpenWithLink && openHref ? 'text-link hover:underline' : 'text-base',
  });

  const openActionButton = renderOpenActionButton({
    attachment,
    isVideo,
    isPdf,
    handleOpen,
  });

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        {/* Icon + name — linkable for ready non-video attachments */}
        {attachmentIdentity}

        {/* Size */}
        {attachment.size_bytes != null && (
          <span className="flex-shrink-0 text-xs text-muted">
            {formatBytes(attachment.size_bytes)}
          </span>
        )}

        {/* Status chip */}
        <span
          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[attachment.status]}`}
        >
          {STATUS_LABELS[attachment.status]}
        </span>

        {/* Open / Download / Play button */}
        {openActionButton}

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
        {onInsertComment &&
          attachment.status === 'READY' &&
          attachment.view_url &&
          !confirming &&
          !editing && (
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
              onMouseDown={(e) => {
                e.preventDefault();
              }}
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
              onMouseDown={(e) => {
                e.preventDefault();
              }}
            >
              {translations['attachment.rename.cancel']}
            </Button>
          </>
        )}

        {/* Delete button / inline confirmation */}
        {!editing &&
          (confirming ? (
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
      {isUploading && <UploadProgressBar progress={uploadProgress} />}

      {/* Video player overlay — use proxy view_url */}
      {videoOpen && isVideo && attachment.view_url && (
        <VideoLightbox
          src={attachment.view_url}
          name={attachment.name}
          onClose={() => {
            setVideoOpen(false);
          }}
        />
      )}

      {/* PDF preview overlay — use proxy view_url */}
      {pdfOpen && isPdf && attachment.view_url && (
        <PdfLightbox
          src={attachment.view_url}
          name={attachment.name}
          onClose={() => {
            setPdfOpen(false);
          }}
        />
      )}

      {/* Image preview overlay — use thumbnail/view proxy url */}
      {imageOpen && isImage && imagePreviewSrc && (
        <ImageLightbox
          src={imagePreviewSrc}
          name={attachment.name}
          onClose={() => {
            setImageOpen(false);
          }}
        />
      )}
    </div>
  );
}
