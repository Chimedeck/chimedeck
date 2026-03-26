// ExternalLinkPreview — rich preview for external URL attachments.
// Lazily fetches title + favicon from /api/v1/link-preview on mount.
// Styled as a compact card matching the Trello attachment mockup:
// favicon | blue link title | ··· dropdown menu
import React, { useEffect, useRef, useState } from 'react';
import { LinkIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { fetchLinkPreview } from '../api';
import type { Attachment } from '../types';
import translations from '../translations/en.json';

interface Props {
  readonly attachment: Attachment;
  readonly canWrite: boolean;
  readonly onDelete: (id: string) => void;
}

export function ExternalLinkPreview({ attachment, canWrite, onDelete }: Props): React.ReactElement {
  const url = attachment.view_url ?? attachment.external_url ?? '';
  const displayName = attachment.alias ?? attachment.name;

  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fetchedRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchLinkPreview({ url })
      .then((res) => {
        setPreviewTitle(res.data.title);
        setFaviconUrl(res.data.faviconUrl);
      })
      .catch(() => {
        // Preview unavailable — displayName fallback is already in place.
      });
  }, [url]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [menuOpen]);

  const title = previewTitle ?? displayName;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition-colors group"
      data-testid="external-link-preview"
    >
      {/* Favicon */}
      <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center">
        {faviconUrl && !faviconError ? (
          <img
            src={faviconUrl}
            alt=""
            className="h-5 w-5 object-contain rounded-sm"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <LinkIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
        )}
      </div>

      {/* Title as a blue link */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-sm text-blue-400 hover:text-blue-300 hover:underline truncate"
      >
        {title}
      </a>

      {/* ··· menu */}
      {canWrite && (
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setMenuOpen((v) => !v); setConfirmDelete(false); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
            aria-label="Link options"
          >
            <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border border-slate-600 bg-slate-800 shadow-xl py-1">
              {confirmDelete ? (
                <div className="px-3 py-2 space-y-1">
                  <p className="text-[11px] text-slate-300 mb-1">Remove link?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); setConfirmDelete(false); onDelete(attachment.id); }}
                      className="text-[11px] text-red-400 hover:text-red-300"
                    >
                      {translations['attachments.item.delete.yes']}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      {translations['attachments.item.delete.no']}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700 hover:text-red-300"
                >
                  {translations['attachments.item.action.delete.ariaLabel']}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
