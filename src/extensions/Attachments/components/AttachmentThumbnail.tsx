// AttachmentThumbnail — renders a clickable image preview card.
// Uses thumbnailUrl when available; falls back to the full download url.
// AttachmentThumbnail is for image/* and VideoThumbnail is for video/*.
import React, { useState } from 'react';
import { PhotoIcon, FilmIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Attachment } from '../types';
import translations from '../translations/en.json';

interface Props {
  attachment: Attachment;
}

function ImageLightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }): React.ReactElement {
  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white focus:outline-none"
        aria-label={translations['attachments.thumbnail.image.close.ariaLabel']}
      >
        <XMarkIcon className="h-8 w-8" />
      </button>
      <img
        src={src}
        alt={name}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
      />
    </div>
  );
}

export function AttachmentThumbnail({ attachment }: Props): React.ReactElement {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // [why] thumbnail_url is the proxy path to the resized thumbnail (set once
  // the thumbnail job runs). Fall back to view_url to show the full image
  // inline when no thumbnail exists yet. Never use the old raw `url` field.
  const src = attachment.thumbnail_url ?? attachment.view_url;
  const fullSrc = attachment.view_url ?? src;

  if (!src) {
    // Placeholder when thumbnail URL is not yet available
    return (
      <div className="flex items-center justify-center w-24 h-16 rounded bg-slate-700 text-slate-500">
        <PhotoIcon className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className="relative w-24 h-16 rounded overflow-hidden border border-slate-600 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={translations['attachments.thumbnail.image.preview.ariaLabel'].replace('{name}', attachment.name)}
      >
        <img
          src={src}
          alt={attachment.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </button>
      {lightboxOpen && fullSrc && (
        <ImageLightbox src={fullSrc} name={attachment.name} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

// ---------- Video ----------

export function VideoLightbox({
  src,
  name,
  onClose,
}: {
  src: string;
  name: string;
  onClose: () => void;
}): React.ReactElement {
  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white focus:outline-none"
        aria-label={translations['attachments.thumbnail.video.close.ariaLabel']}
      >
        <XMarkIcon className="h-8 w-8" />
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={src}
        controls
        autoPlay
        className="max-w-[90vw] max-h-[85vh] rounded shadow-2xl outline-none"
      />
    </div>
  );
}

export function VideoThumbnail({ attachment }: Props): React.ReactElement {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const src = attachment.view_url;

  if (!src) {
    return (
      <div className="flex items-center justify-center w-24 h-16 rounded bg-slate-700 text-slate-500">
        <FilmIcon className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className="relative w-24 h-16 rounded overflow-hidden border border-slate-600 bg-slate-800 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center group"
        aria-label={translations['attachments.thumbnail.video.play.ariaLabel'].replace('{name}', attachment.name)}
      >
        <FilmIcon className="h-6 w-6 text-slate-500 group-hover:text-slate-300 transition-colors" aria-hidden="true" />
        <PlayIcon className="absolute h-5 w-5 text-white/80 group-hover:text-white" aria-hidden="true" />
      </button>
      {lightboxOpen && (
        <VideoLightbox src={src} name={attachment.name} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
