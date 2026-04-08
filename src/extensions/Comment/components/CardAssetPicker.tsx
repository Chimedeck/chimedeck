// CardAssetPicker — inline popover that lets the user either upload a new file
// or pick an existing card attachment to insert into a comment.
// Appears anchored below the toolbar's paperclip button.
// [why] Receives already-loaded attachments from CommentEditor to avoid a duplicate fetch.
import { useEffect, useRef } from 'react';
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import type { Attachment } from '~/extensions/Attachments/types';
import { getMimeIcon } from '~/extensions/Attachments/utils/mimeIcon';
import translations from '../translations/en.json';

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
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-bg-base shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-subtle uppercase tracking-wide">
          {translations['comment.assetPicker.title']}
        </span>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={translations['comment.assetPicker.close']}
          onClick={onClose}
          className="!p-0.5"
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Upload new file action */}
      <div className="p-2 border-b border-border">
        <button
          type="button"
          data-testid="asset-picker-upload-new"
          onClick={() => { onUploadNew(); onClose(); }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-base hover:bg-bg-surface transition-colors"
        >
          <ArrowUpTrayIcon className="h-4 w-4 text-muted flex-shrink-0" />
          <span>{translations['comment.assetPicker.uploadNew']}</span>
        </button>
      </div>

      {/* Existing card assets */}
      <div className="p-2">
        <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted">
          {translations['comment.assetPicker.existingTitle']}
        </p>

        {attachments.length === 0 && (
          <p className="px-1 py-3 text-center text-xs text-muted">
            {translations['comment.assetPicker.empty']}
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
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg-surface transition-colors"
      >
        {/* Thumbnail or icon */}
        {isImage ? (
          <img
            src={attachment.thumbnail_url ?? attachment.view_url ?? ''}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 flex-shrink-0 rounded object-cover border border-border"
          />
        ) : (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-border bg-bg-surface">
            <Icon className="h-4 w-4 text-muted" />
          </span>
        )}

        {/* Name */}
        <span className="min-w-0 flex-1 truncate text-xs text-base">
          {attachment.name}
        </span>

        {/* Insert label */}
        <span className="flex-shrink-0 text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">
          {translations['comment.assetPicker.insert']}
        </span>
      </button>
    </li>
  );
}
