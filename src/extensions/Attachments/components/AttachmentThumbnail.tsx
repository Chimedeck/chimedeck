// AttachmentThumbnail — renders a clickable image preview card.
// Uses thumbnailUrl when available; falls back to the full download url.
// Only intended for image/* attachments with status READY.
import React from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import type { Attachment } from '../types';

interface Props {
  attachment: Attachment;
}

export function AttachmentThumbnail({ attachment }: Props): React.ReactElement {
  const src = attachment.thumbnail_url ?? attachment.url;

  const handleClick = (): void => {
    if (attachment.url) {
      window.open(attachment.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!src) {
    // Placeholder when thumbnail URL is not yet available
    return (
      <div className="flex items-center justify-center w-24 h-16 rounded bg-gray-100 text-gray-300">
        <PhotoIcon className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="relative w-24 h-16 rounded overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-400"
      aria-label={`Open ${attachment.name}`}
    >
      <img
        src={src}
        alt={attachment.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </button>
  );
}
