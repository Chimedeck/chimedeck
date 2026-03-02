// CardModal — full detail overlay for viewing and editing a card.
import { useState, useEffect } from 'react';
import type { Card } from '../api';

interface Props {
  card: Card;
  boardTitle: string;
  listTitle: string;
  onClose: () => void;
  onUpdate: (cardId: string, fields: { title?: string; description?: string; due_date?: string | null }) => Promise<void>;
  onArchive: (cardId: string) => Promise<void>;
  onMove: (cardId: string) => void;
  onDuplicate: (cardId: string) => Promise<void>;
}

const CardModal = ({
  card,
  boardTitle,
  listTitle,
  onClose,
  onUpdate,
  onArchive,
  onMove,
  onDuplicate,
}: Props) => {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }
    if (trimmedTitle.length > 512) {
      setError('Title must be 512 characters or fewer');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onUpdate(card.id, { title: trimmedTitle, description: description.trim() });
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16"
      role="dialog"
      aria-modal="true"
      aria-label={`Card: ${card.title}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3 border-b p-4">
          <div className="flex-1">
            <input
              className="w-full rounded border border-transparent px-1 py-0.5 text-lg font-semibold focus:border-blue-400 focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Card title"
              disabled={card.archived}
            />
            <p className="mt-0.5 text-xs text-gray-500">
              in list <span className="font-medium">{listTitle}</span> on board{' '}
              <span className="font-medium">{boardTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-3 gap-4 p-4">
          <div className="col-span-2 flex flex-col gap-4">
            {card.archived && (
              <div className="rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
                This card is archived.
              </div>
            )}

            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Description</h3>
              <textarea
                className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                rows={5}
                placeholder="Add a more detailed description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={card.archived}
                aria-label="Card description"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            {!card.archived && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* Sidebar actions */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase text-gray-500">Actions</p>
            <button
              onClick={() => onMove(card.id)}
              className="w-full rounded bg-gray-100 px-3 py-1.5 text-left text-sm hover:bg-gray-200"
              disabled={card.archived}
            >
              Move card
            </button>
            <button
              onClick={() => onDuplicate(card.id)}
              className="w-full rounded bg-gray-100 px-3 py-1.5 text-left text-sm hover:bg-gray-200"
              disabled={card.archived}
            >
              Duplicate
            </button>
            <button
              onClick={() => onArchive(card.id)}
              className="w-full rounded bg-gray-100 px-3 py-1.5 text-left text-sm hover:bg-gray-200"
            >
              {card.archived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardModal;
