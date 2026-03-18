// CardAssetPicker — inline popover that lets the user either upload a new file
// or pick an existing card attachment to insert into a comment.
// Appears anchored below the toolbar's paperclip button.
// [why] Receives already-loaded attachments from CommentEditor to avoid a duplicate fetch.
import { useEffect, useRef } from 'react';
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Attachment } from '~/extensions/Attachments/types';
import { getMimeIcon } from '~/extensions/Attachments/utils/mimeIcon';

interface Props {
  /** Already-loaded card attachments passed down from CommentEditor */
  attachments: Attachment[];
  /** Called when user wants to upload a fresh file */
  onUploadNew: () => void;
  /** Called when user picks an existing attachment to insert inline */
  onInsert: (attachment: Attachment) => void;
  /** Close the picker */
  onClose: () => void;
}

export function CardAssetPicker({ attachments, onUploadNew, onInsert, onClose }: Readonly<Props>) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      data-testid="card-asset-picker"
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 px-3 py-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wide">
          Insert attachment
        </span>
        <button
          type="button"
          aria-label="Close picker"
          onClick={onClose}
          className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Upload new file action */}
      <div className="p-2 border-b border-gray-100 dark:border-slate-800">
        <button
          type="button"
          data-testid="asset-picker-upload-new"
          onClick={() => { onUploadNew(); onClose(); }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowUpTrayIcon className="h-4 w-4 text-gray-400 dark:text-slate-400 flex-shrink-0" />
          <span>Upload from computer</span>
        </button>
      </div>

      {/* Existing card assets */}
      <div className="p-2">
        <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">
          Card attachments
        </p>

        {attachments.length === 0 && (
          <p className="px-1 py-3 text-center text-xs text-gray-400 dark:text-slate-500">
            No attachments yet
          </p>
        )}

        {attachments.length > 0 && (
          <ul className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
            {attachments.map((att) => (
              <AssetRow key={att.id} attachment={att} onInsert={() => { onInsert(att); onClose(); }} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------- AssetRow ----------

interface AssetRowProps {
  attachment: Attachment;
  onInsert: () => void;
}

function AssetRow({ attachment, onInsert }: Readonly<AssetRowProps>) {
  const isImage = attachment.content_type?.startsWith('image/') ?? false;
  const Icon = getMimeIcon(attachment.content_type);

  return (
    <li>
      <button
        type="button"
        data-testid="asset-picker-item"
        onClick={onInsert}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      >
        {/* Thumbnail or icon */}
        {isImage ? (
          <img
            src={attachment.thumbnail_url ?? attachment.url ?? ''}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 flex-shrink-0 rounded object-cover border border-gray-200 dark:border-slate-700"
          />
        ) : (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <Icon className="h-4 w-4 text-gray-400 dark:text-slate-400" />
          </span>
        )}

        {/* Name */}
        <span className="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-slate-200">
          {attachment.name}
        </span>

        {/* Insert label */}
        <span className="flex-shrink-0 text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">
          Insert
        </span>
      </button>
    </li>
  );
}
