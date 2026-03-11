// AttachmentItem — single attachment row: type icon, name, size, status chip, progress bar,
// and delete button with inline confirmation.
import React, { useState } from 'react';
import { TrashIcon, LinkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { Attachment } from '../types';
import { getMimeIcon } from '../utils/mimeIcon';
import { formatBytes } from '../utils/formatBytes';
import { UploadProgressBar } from './UploadProgressBar';

interface Props {
  attachment: Attachment;
  /** undefined while the file is still uploading (no server record yet) */
  uploadProgress?: number | null;
  onDelete: (id: string) => void;
}

const STATUS_CLASSES: Record<Attachment['status'], string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  SCANNING: 'bg-yellow-100 text-yellow-700',
  READY: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<Attachment['status'], string> = {
  PENDING: 'Uploading',
  SCANNING: 'Scanning',
  READY: 'Ready',
  REJECTED: 'Rejected',
};

export function AttachmentItem({ attachment, uploadProgress, onDelete }: Props): React.ReactElement {
  const [confirming, setConfirming] = useState(false);

  const Icon = attachment.type === 'URL' ? LinkIcon : getMimeIcon(attachment.content_type);
  const isUploading = attachment.status === 'PENDING' && uploadProgress != null;

  const handleOpen = (): void => {
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
    <div className="flex flex-col gap-1 py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        {/* File-type icon badge */}
        <span className="flex-shrink-0 text-gray-400">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        {/* Name — truncated */}
        <span className="flex-1 min-w-0 text-sm text-gray-800 truncate" title={attachment.name}>
          {attachment.name}
        </span>

        {/* Size */}
        {attachment.size_bytes != null && (
          <span className="flex-shrink-0 text-xs text-gray-400">{formatBytes(attachment.size_bytes)}</span>
        )}

        {/* Status chip */}
        <span
          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[attachment.status]}`}
        >
          {STATUS_LABELS[attachment.status]}
        </span>

        {/* Open / Download button */}
        {attachment.status === 'READY' && (
          <button
            onClick={handleOpen}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            aria-label={attachment.type === 'URL' ? 'Open link' : 'Download file'}
          >
            {attachment.type === 'URL' ? (
              <LinkIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}

        {/* Delete button / inline confirmation */}
        {confirming ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-gray-600">Delete?</span>
            <button
              onClick={handleDeleteConfirm}
              className="text-red-600 hover:text-red-800 font-medium"
            >
              Yes
            </button>
            <button onClick={handleDeleteCancel} className="text-gray-500 hover:text-gray-700">
              No
            </button>
          </span>
        ) : (
          <button
            onClick={handleDeleteClick}
            className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
            aria-label="Delete attachment"
          >
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Progress bar — only while uploading */}
      {isUploading && <UploadProgressBar progress={uploadProgress!} />}
    </div>
  );
}
