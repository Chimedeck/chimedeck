// InlineUploadPreview — compact upload-progress row for use inside rich-text editors.
// Image files show an object-URL thumbnail; all others show a file-type icon.
// Progress bar shown while in-flight; "Uploaded" caption on success; error text on failure.
// The × button cancels an in-progress upload or dismisses a completed/failed entry.
import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { UploadEntry } from '../types';
import { getMimeIcon } from '../utils/mimeIcon';
import { formatBytes } from '../utils/formatBytes';
import { UploadProgressBar } from './UploadProgressBar';
import translations from '../translations/en.json';

interface Props {
  entry: UploadEntry;
  onCancel: (clientId: string) => void;
}

export function InlineUploadPreview({ entry, onCancel }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isImage = entry.file.type.startsWith('image/');

  // Build a local preview URL for image files and revoke it on unmount
  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(entry.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [entry.file, isImage]);

  // Auto-dismiss completed entries after 2 s so they don't clutter the editor
  useEffect(() => {
    if (entry.phase !== 'done') return;
    const id = window.setTimeout(() => onCancel(entry.clientId), 2000);
    return () => window.clearTimeout(id);
  }, [entry.phase, entry.clientId, onCancel]);

  const Icon = getMimeIcon(entry.file.type);

  return (
    <div
      data-testid="inline-upload-preview"
      className="flex items-start gap-2 rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 p-2"
    >
      {/* Thumbnail (image) or file-type icon (non-image) */}
      {isImage && objectUrl ? (
        <img
          src={objectUrl}
          alt={entry.file.name}
          aria-hidden="true"
          className="h-10 w-10 flex-shrink-0 rounded object-cover border border-gray-200 dark:border-slate-700"
        />
      ) : (
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <Icon className="h-5 w-5 text-gray-400 dark:text-slate-400" aria-hidden="true" />
        </span>
      )}

      {/* Filename + size + progress / status */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-xs text-gray-700 dark:text-slate-200"
          title={entry.file.name}
        >
          {entry.file.name}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500">
          {formatBytes(entry.file.size)}
        </p>

        {entry.phase === 'error' && (
          <p
            role="alert"
            className="mt-0.5 text-[10px] text-red-600 dark:text-red-400"
          >
            {entry.error ?? translations['attachments.inline.uploadFailed']}
          </p>
        )}

        {entry.phase === 'done' && (
          <p className="mt-0.5 text-[10px] text-green-600 dark:text-green-400">{translations['attachments.inline.uploaded']}</p>
        )}

        {/* [why] 'pending' means the file is queued locally and will upload on submit. */}
        {entry.phase === 'pending' && (
          <p className="mt-0.5 text-[10px] text-gray-400 dark:text-slate-500">{translations['attachments.inline.queued']}</p>
        )}

        {entry.phase !== 'error' && entry.phase !== 'done' && entry.phase !== 'pending' && (
          <div className="mt-1">
            <UploadProgressBar
              progress={entry.phase === 'uploading' ? entry.progress : null}
              label={translations['attachments.inline.uploading.label'].replace('{fileName}', entry.file.name)}
            />
          </div>
        )}
      </div>

      {/* Cancel / dismiss */}
      <button
        type="button"
        aria-label={translations['attachments.inline.cancel.ariaLabel'].replace('{fileName}', entry.file.name)}
        title={entry.phase === 'pending' ? translations['attachments.inline.cancel.remove'] : entry.phase === 'error' || entry.phase === 'done' ? translations['attachments.inline.cancel.dismiss'] : translations['attachments.inline.cancel.cancelUpload']}
        className="flex-shrink-0 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
        onClick={() => onCancel(entry.clientId)}
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
