// ExternalLinkPreview — rich preview for external URL attachments.
// Lazily fetches title + favicon from /api/v1/link-preview on mount.
// Styled as a compact card matching the Trello attachment mockup:
// favicon | blue link title | ··· dropdown menu
import React, { useEffect, useRef, useState } from 'react';
import { LinkIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import Button from '../../../common/components/Button';
import { fetchLinkPreview } from '../api';
import type { Attachment } from '../types';
import translations from '../translations/en.json';

interface Props {
  readonly attachment: Attachment;
  readonly canWrite: boolean;
  readonly onDelete: (id: string) => void;
  readonly onRename: (id: string, alias: string) => void;
  readonly onUpdateUrl: (id: string, url: string) => void;
}

export function ExternalLinkPreview({ attachment, canWrite, onDelete, onRename, onUpdateUrl }: Props): React.ReactElement {
  const url = attachment.view_url ?? attachment.external_url ?? '';
  const displayName = attachment.alias ?? attachment.name;

  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [renameValue, setRenameValue] = useState(displayName);
  const [urlValue, setUrlValue] = useState(url);
  const fetchedUrlRef = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!url || fetchedUrlRef.current === url) return;
    fetchedUrlRef.current = url;
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

  useEffect(() => {
    if (!editingName) {
      setRenameValue(displayName);
    }
  }, [displayName, editingName]);

  useEffect(() => {
    if (!editingUrl) {
      setUrlValue(url);
    }
  }, [url, editingUrl]);

  const title = displayName || previewTitle || url;

  const startRename = (): void => {
    setRenameValue(displayName);
    setMenuOpen(false);
    setConfirmDelete(false);
    setEditingUrl(false);
    setEditingName(true);
  };

  const startEditUrl = (): void => {
    setUrlValue(url);
    setMenuOpen(false);
    setConfirmDelete(false);
    setEditingName(false);
    setEditingUrl(true);
  };

  const cancelRename = (): void => {
    setEditingName(false);
    setRenameValue(displayName);
  };

  const cancelEditUrl = (): void => {
    setEditingUrl(false);
    setUrlValue(url);
  };

  const submitRename = (): void => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameValue(displayName);
      setEditingName(false);
      return;
    }
    if (trimmed !== displayName) {
      onRename(attachment.id, trimmed);
    }
    setEditingName(false);
  };

  const submitUrlEdit = (): void => {
    const trimmed = urlValue.trim();
    if (!trimmed) {
      setUrlValue(url);
      setEditingUrl(false);
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      return;
    }
    if (trimmed !== url) {
      onUpdateUrl(attachment.id, trimmed);
      fetchedUrlRef.current = null;
      setPreviewTitle(null);
      setFaviconUrl(null);
      setFaviconError(false);
    }
    setEditingUrl(false);
  };

  let attachmentIdentity: React.ReactNode;
  if (editingName) {
    attachmentIdentity = (
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input
          type="text"
          value={renameValue}
          onChange={(e) => { setRenameValue(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitRename();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelRename();
            }
          }}
          placeholder={translations['attachment.rename.placeholder']}
          aria-label={translations['attachment.rename.placeholder']}
          className="w-full min-w-0 text-sm bg-bg-overlay text-base placeholder:text-subtle border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="external-link-rename-input"
          autoFocus
        />
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={submitRename}
          className="flex-shrink-0 p-0 text-xs"
          aria-label={translations['attachment.rename.save']}
          data-testid="external-link-rename-save"
        >
          {translations['attachment.rename.save']}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={cancelRename}
          className="flex-shrink-0 p-0 text-xs text-muted hover:text-subtle"
          aria-label={translations['attachments.panel.link.cancel']}
        >
          {translations['attachments.panel.link.cancel']}
        </Button>
      </div>
    );
  } else if (editingUrl) {
    attachmentIdentity = (
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input
          type="url"
          value={urlValue}
          onChange={(e) => { setUrlValue(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitUrlEdit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEditUrl();
            }
          }}
          placeholder={translations['attachments.panel.link.urlPlaceholder']}
          aria-label={translations['attachments.panel.link.urlPlaceholder']}
          className="w-full min-w-0 text-sm bg-bg-overlay text-base placeholder:text-subtle border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="external-link-url-input"
          autoFocus
        />
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={submitUrlEdit}
          className="flex-shrink-0 p-0 text-xs"
          aria-label={translations['attachment.rename.save']}
          data-testid="external-link-url-save"
        >
          {translations['attachment.rename.save']}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={cancelEditUrl}
          className="flex-shrink-0 p-0 text-xs text-muted hover:text-subtle"
          aria-label={translations['attachments.panel.link.cancel']}
        >
          {translations['attachments.panel.link.cancel']}
        </Button>
      </div>
    );
  } else {
    attachmentIdentity = (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-sm text-blue-400 hover:text-blue-300 hover:underline truncate"
        title={title}
      >
        {title}
      </a>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-bg-surface/60 hover:bg-bg-surface transition-colors group"
      data-testid="external-link-preview"
    >
      {/* Favicon */}
      <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center">
        {faviconUrl && !faviconError ? (
          <img
            src={faviconUrl}
            alt=""
            className="h-5 w-5 object-contain rounded-sm"
            onError={() => { setFaviconError(true); }}
          />
        ) : (
          <LinkIcon className="h-4 w-4 text-muted" aria-hidden="true" />
        )}
      </div>

      {/* Title as a blue link or inline editor */}
      {attachmentIdentity}

      {/* ··· menu */}
      {canWrite && (
        <div ref={menuRef} className="relative flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => { setMenuOpen((v) => !v); setConfirmDelete(false); }}
            className="h-6 w-6 p-0.5 text-muted hover:text-subtle hover:bg-bg-overlay"
            aria-label="Link options"
          >
            <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          </Button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[170px] rounded-lg border border-border bg-bg-surface shadow-xl py-1">
              {confirmDelete ? (
                <div className="px-3 py-2 space-y-1">
                  <p className="text-[11px] text-subtle mb-1">Remove link?</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => { setMenuOpen(false); setConfirmDelete(false); onDelete(attachment.id); }}
                      className="p-0 text-[11px] text-danger hover:text-danger"
                    >
                      {translations['attachments.item.delete.yes']}
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => { setConfirmDelete(false); }}
                      className="p-0 text-[11px] text-muted hover:text-subtle"
                    >
                      {translations['attachments.item.delete.no']}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startEditUrl}
                    className="w-full justify-start rounded-none px-3 py-1.5 text-left text-[11px] hover:bg-bg-overlay"
                  >
                    {translations['attachments.link.action.editUrl']}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startRename}
                    className="w-full justify-start rounded-none px-3 py-1.5 text-left text-[11px] hover:bg-bg-overlay"
                  >
                    {translations['attachments.link.action.editDisplayName']}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setConfirmDelete(true); }}
                    className="w-full justify-start rounded-none px-3 py-1.5 text-left text-[11px] text-danger hover:bg-bg-overlay hover:text-danger"
                  >
                    {translations['attachments.item.action.delete.ariaLabel']}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
