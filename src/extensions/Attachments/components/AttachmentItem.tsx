// AttachmentItem — single attachment row: type icon, name, size, status chip, progress bar,
// and delete button with inline confirmation.
import React, { useState } from 'react';
import { TrashIcon, LinkIcon, ArrowDownTrayIcon, PlayIcon } from '@heroicons/react/24/outline';
import type { Attachment } from '../types';
import { getMimeIcon } from '../utils/mimeIcon';
import { formatBytes } from '../utils/formatBytes';
import { UploadProgressBar } from './UploadProgressBar';
import { VideoLightbox } from './AttachmentThumbnail';
import translations from '../translations/en.json';

interface Props {
  attachment: Attachment;
  /** undefined while the file is still uploading (no server record yet) */
  uploadProgress?: number | null;
  onDelete: (id: string) => void;
}

const STATUS_CLASSES: Record<Attachment['status'], string> = {
  PENDING: 'bg-slate-600 text-slate-200',
  SCANNING: 'bg-yellow-900/50 text-yellow-300',
  READY: 'bg-green-900/50 text-green-300',
  REJECTED: 'bg-red-900/50 text-red-300',
};

const STATUS_LABELS: Record<Attachment['status'], string> = {
  PENDING: translations['attachments.item.status.uploading'],
  SCANNING: translations['attachments.item.status.scanning'],
  READY: translations['attachments.item.status.ready'],
  REJECTED: translations['attachments.item.status.rejected'],
};

export function AttachmentItem({ attachment, uploadProgress, onDelete }: Props): React.ReactElement {
  const [confirming, setConfirming] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const Icon = attachment.type === 'URL' ? LinkIcon : getMimeIcon(attachment.content_type);
  const isUploading = attachment.status === 'PENDING' && uploadProgress != null;
  const isVideo = attachment.type !== 'URL' && attachment.content_type?.startsWith('video/');

  const handleOpen = (): void => {
    if (isVideo) {
      setVideoOpen(true);
      return;
    }
    const href = attachment.type === 'URL' ? attachment.external_url : attachment.url;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteClick = (): void => setConfirming(true);
  const handleDeleteConfirm = (): void => {
    setConfirming(false);
    onDelete(attachment.id);
  };
  const handleDeleteCancel = (): void => setConfirming(false);

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-slate-700 last:border-0">
      <div className="flex items-center gap-2">
        {/* File-type icon badge */}
        <span className="flex-shrink-0 text-slate-400">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        {/* Name — truncated */}
        <span className="flex-1 min-w-0 text-sm text-slate-100 truncate" title={attachment.name}>
          {attachment.name}
        </span>

        {/* Size */}
        {attachment.size_bytes != null && (
          <span className="flex-shrink-0 text-xs text-slate-400">{formatBytes(attachment.size_bytes)}</span>
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
              <button
                onClick={handleOpen}
                className="flex-shrink-0 text-slate-400 hover:text-slate-200"
                aria-label={translations['attachments.item.action.openLink.ariaLabel']}
              >
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          }
          if (isVideo) {
            return (
              <button
                onClick={handleOpen}
                className="flex-shrink-0 text-slate-400 hover:text-slate-200"
                aria-label={translations['attachments.item.action.playVideo.ariaLabel']}
              >
                <PlayIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          }
          return (
            <button
              onClick={handleOpen}
              className="flex-shrink-0 text-slate-400 hover:text-slate-200"
              aria-label={translations['attachments.item.action.downloadFile.ariaLabel']}
            >
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          );
        })()}

        {/* Delete button / inline confirmation */}
        {confirming ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-slate-300">{translations['attachments.item.delete.confirm']}</span>
            <button
              onClick={handleDeleteConfirm}
              className="text-red-400 hover:text-red-300 font-medium"
            >
              {translations['attachments.item.delete.yes']}
            </button>
            <button onClick={handleDeleteCancel} className="text-slate-400 hover:text-slate-200">
              {translations['attachments.item.delete.no']}
            </button>
          </span>
        ) : (
          <button
            onClick={handleDeleteClick}
            className="flex-shrink-0 text-slate-500 hover:text-red-400 transition-colors"
            aria-label={translations['attachments.item.action.delete.ariaLabel']}
          >
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Progress bar — only while uploading */}
      {isUploading && <UploadProgressBar progress={uploadProgress!} />}

      {/* Video player overlay */}
      {videoOpen && isVideo && attachment.url && (
        <VideoLightbox src={attachment.url} name={attachment.name} onClose={() => setVideoOpen(false)} />
      )}
    </div>
  );
}
