// CardAttachmentPreview — compact card-style attachment matching the Trello mockup.
// Cards sit in a 2-column flex-wrap grid managed by AttachmentPanel.
import React, { useEffect, useRef, useState } from 'react';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import type { CardPreview } from '../types';
import translations from '../translations/en.json';

interface Props {
  readonly attachmentId: string;
  readonly card: CardPreview;
  readonly cardUrl: string;
  readonly canWrite: boolean;
  readonly onDelete: (id: string) => void;
}

/** Deterministic muted background colour derived from the board name. */
function boardColor(name: string | null): string {
  const palette: string[] = ['#3b5998','#1da1f2','#0077b5','#e4405f','#ff6600','#6f42c1','#20c997','#fd7e14'];
  if (!name) return palette[0] ?? '#3b5998';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (name.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length] ?? '#3b5998';
}

export function CardAttachmentPreview({ attachmentId, card, cardUrl, canWrite, onDelete }: Props): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
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

  const initials = (card.board_name ?? '?').slice(0, 2).toUpperCase();
  const bgColor = boardColor(card.board_name);

  return (
    <div
      className="flex flex-col rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition-colors overflow-hidden"
      style={{ width: 'calc(50% - 4px)' }}
      data-testid="card-attachment-preview"
    >
      {/* Clickable body */}
      <button
        type="button"
        onClick={() => { window.open(cardUrl, '_blank', 'noopener,noreferrer'); }}
        className="flex-1 text-left p-2.5 min-w-0"
      >
        {/* Board avatar + board name + list name */}
        <div className="flex items-center gap-1.5 mb-2">
          <div
            className="flex-shrink-0 h-5 w-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-300 truncate leading-tight">{card.board_name ?? ''}</p>
            {card.list_name && (
              <p className="text-[10px] text-slate-500 truncate leading-tight">{card.list_name}</p>
            )}
          </div>
        </div>

        {/* Labels */}
        {card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {card.labels.map((label) => (
              <span
                key={label.id}
                className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white/90 truncate max-w-full"
                style={{ backgroundColor: label.color }}
                title={label.name}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* Card title — allow wrapping (matches mockup multi-line titles) */}
        <p className="text-xs font-medium text-slate-100 leading-snug line-clamp-3">{card.title}</p>
      </button>

      {/* Footer: ··· menu */}
      <div className="flex items-center px-2 pb-2">
        {canWrite && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => { setMenuOpen((v) => !v); setConfirmDelete(false); }}
              className="flex items-center gap-0.5 text-slate-500 hover:text-slate-300 rounded px-1 py-0.5 hover:bg-slate-700 transition-colors"
              aria-label="Card attachment options"
            >
              <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div className="absolute left-0 bottom-full mb-1 z-20 min-w-[140px] rounded-lg border border-slate-600 bg-slate-800 shadow-xl py-1">
                {confirmDelete ? (
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-[11px] text-slate-300 mb-1">Remove attachment?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); setConfirmDelete(false); onDelete(attachmentId); }}
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
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
