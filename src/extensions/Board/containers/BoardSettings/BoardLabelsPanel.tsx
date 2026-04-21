// BoardLabelsPanel — Labels management entry row + modal for Board Settings.
// Allows creating, editing, and listing board-scoped labels without opening a card.
import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { TagIcon } from '@heroicons/react/24/outline';
import type { Label } from '~/extensions/Card/api';
import { contrastText } from '~/extensions/Card/components/LabelChip';
import { getBoardLabels, createBoardLabel, updateBoardLabel, deleteBoardLabel } from '~/extensions/Card/api/cardDetail';
import { apiClient } from '~/common/api/client';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { boardSliceActions } from '~/extensions/Board/slices/boardSlice';
// boardSliceActions used: updateLabelInCards, removeLabelFromCards

const PRESET_COLORS = [
  { name: 'Dark green', hex: '#1f6835' },
  { name: 'Dark yellow', hex: '#7d5a00' },
  { name: 'Dark orange', hex: '#9e3a00' },
  { name: 'Dark red', hex: '#7c1d22' },
  { name: 'Dark purple', hex: '#4a1060' },
  { name: 'Dark slate', hex: '#1d3557' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Subtle lime', hex: '#84cc16' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Light gray', hex: '#94a3b8' },
  { name: 'Dark gray', hex: '#475569' },
  { name: 'Slate', hex: '#64748b' },
  { name: 'None', hex: '' },
];

// ------------------------------------------------------------------
// Color grid
// ------------------------------------------------------------------
const ColorGrid = ({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (hex: string) => void;
}) => (
  <div className="grid grid-cols-5 gap-1.5">
    {PRESET_COLORS.filter((c) => c.hex !== '').map((c) => (
      <button
        key={c.hex}
        type="button"
        title={c.name}
        className={`h-8 w-full rounded-md transition-colors focus:outline-none relative ${
          selected === c.hex ? 'ring-2 ring-primary ring-offset-1' : ''
        }`}
        style={{ backgroundColor: c.hex }}
        onClick={() => onChange(c.hex)}
        aria-label={c.name}
      >
        {selected === c.hex && (
          <svg
            className="absolute inset-0 m-auto h-4 w-4"
            viewBox="0 0 20 20"
            fill={contrastText(c.hex)}
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
    ))}
  </div>
);

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------
interface Props {
  boardId: string;
}

type ModalView = 'list' | 'create' | { editId: string };

const BoardLabelsPanel = ({ boardId }: Props) => {
  const dispatch = useAppDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<ModalView>('list');
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[6]?.hex ?? '#22c55e');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Fetch labels when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    setLoading(true);
    getBoardLabels({ api: apiClient, boardId })
      .then((fetched) => setLabels(fetched))
      .finally(() => setLoading(false));
  }, [modalOpen, boardId]);

  // Focus the right input when view changes
  useEffect(() => {
    if (!modalOpen) return;
    if (view === 'list') {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [view, modalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setView('list');
    setSearchQuery('');
    setFormName('');
    setFormColor(PRESET_COLORS[6]?.hex ?? '#22c55e');
    setConfirmDelete(false);
  };

  const openCreate = () => {
    setFormName('');
    setFormColor(PRESET_COLORS[6]?.hex ?? '#22c55e');
    setConfirmDelete(false);
    setView('create');
  };

  const openEdit = (label: Label) => {
    setFormName(label.name);
    setFormColor(label.color);
    setConfirmDelete(false);
    setView({ editId: label.id });
  };

  const handleCreate = async () => {
    const name = formName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const created = await createBoardLabel({ api: apiClient, boardId, name, color: formColor });
      setLabels((prev) => [...prev, created]);
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (typeof view !== 'object') return;
    const name = formName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const updated = await updateBoardLabel({ api: apiClient, labelId: view.editId, name, color: formColor });
      setLabels((prev) => prev.map((l) => (l.id === view.editId ? updated : l)));
      // [why] Propagate the updated label to all cards on the board in local Redux state
      // so the board view reflects the change immediately without a full refresh.
      dispatch(boardSliceActions.updateLabelInCards({ label: updated }));
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLabel = async () => {
    if (typeof view !== 'object') return;
    setDeleting(true);
    try {
      await deleteBoardLabel({ api: apiClient, labelId: view.editId });
      dispatch(boardSliceActions.removeLabelFromCards({ labelId: view.editId }));
      setLabels((prev) => prev.filter((l) => l.id !== (view as { editId: string }).editId));
      setView('list');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const isEditView = typeof view === 'object';
  const editingLabel = isEditView ? labels.find((l) => l.id === (view as { editId: string }).editId) : null;

  const filteredLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  let headerTitle: string;
  if (view === 'list') {
    headerTitle = 'Labels';
  } else if (view === 'create') {
    headerTitle = 'Create label';
  } else {
    headerTitle = 'Edit label';
  }

  const canGoBack = view !== 'list';

  return (
    <>
      {/* Entry row — matches the style of the Plugins row */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full text-left px-3 py-2 rounded text-sm text-subtle hover:bg-bg-surface flex items-center gap-2 transition-colors"
      >
        <TagIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Labels</span>
      </button>

      <Dialog.Root open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none"
            onInteractOutside={() => closeModal()}
            onEscapeKeyDown={() => closeModal()}
            aria-label="Labels"
          >
            <Dialog.Title className="sr-only">Labels</Dialog.Title>
            <div
              className="relative w-80 rounded-xl bg-bg-surface border border-border shadow-2xl flex flex-col max-h-[min(36rem,80vh)] overflow-hidden pointer-events-auto"
            >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              {canGoBack ? (
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-muted hover:text-base transition-colors"
                  onClick={() => setView('list')}
                >
                  {/* left chevron */}
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                  {headerTitle}
                </button>
              ) : (
                <span className="text-sm font-semibold text-base">{headerTitle}</span>
              )}
              <button
                type="button"
                className="rounded p-0.5 text-subtle hover:text-base transition-colors"
                onClick={closeModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* ── List view ── */}
            {view === 'list' && (
              <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
                <input
                  ref={searchInputRef}
                  className="w-full bg-bg-overlay border border-border rounded-lg px-2.5 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Search labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {loading && (
                  <p className="text-xs text-subtle px-1 py-2">Loading…</p>
                )}

                {!loading && filteredLabels.length === 0 && (
                  <p className="text-xs text-subtle px-1 py-2">
                    {searchQuery ? 'No labels found.' : 'No labels yet. Create one below.'}
                  </p>
                )}

                {!loading && filteredLabels.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted px-1 pb-1">Labels</p>
                    <div className="space-y-1">
                      {filteredLabels.map((label) => (
                        <div key={label.id} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="flex-1 flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 min-w-0 truncate"
                            style={{ backgroundColor: label.color, color: contrastText(label.color) }}
                            title={label.name}
                            onClick={() => openEdit(label)}
                          >
                            {label.name}
                          </button>
                          <button
                            type="button"
                            className="flex-shrink-0 rounded p-1.5 text-subtle hover:bg-bg-overlay hover:text-base transition-colors"
                            onClick={() => openEdit(label)}
                            aria-label={`Edit ${label.name}`}
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="w-full rounded-lg bg-bg-overlay hover:bg-bg-sunken text-sm text-base py-2 transition-colors"
                  onClick={openCreate}
                >
                  Create a new label
                </button>
              </div>
            )}

            {/* ── Create / Edit form ── */}
            {(view === 'create' || isEditView) && (
              <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
                {/* Label preview */}
                {formName.trim() && (
                  <div
                    className="w-full rounded-md px-3 py-2 text-sm font-semibold text-center truncate"
                    style={{
                      backgroundColor: formColor || '#cbd5e1',
                      color: formColor ? contrastText(formColor) : 'var(--text-base)',
                    }}
                  >
                    {formName}
                  </div>
                )}
                {!formName.trim() && isEditView && editingLabel && (
                  <div
                    className="w-full rounded-md px-3 py-2 text-sm font-semibold text-center truncate opacity-60"
                    style={{
                      backgroundColor: formColor || '#cbd5e1',
                      color: formColor ? contrastText(formColor) : 'var(--text-base)',
                    }}
                  >
                    {editingLabel.name}
                  </div>
                )}
                {!formName.trim() && view === 'create' && (
                  <div className="w-full rounded-md px-3 py-2 text-sm font-semibold text-center bg-bg-overlay text-subtle">
                    Label preview
                  </div>
                )}

                {/* Title input */}
                <div>
                  <p className="text-xs font-medium text-muted mb-1">Title</p>
                  <input
                    ref={nameInputRef}
                    className="w-full bg-bg-overlay border border-border rounded-lg px-2.5 py-1.5 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Label name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void (view === 'create' ? handleCreate() : handleSaveEdit());
                      }
                    }}
                  />
                </div>

                {/* Color grid */}
                <div>
                  <p className="text-xs font-medium text-muted mb-1.5">Select a color</p>
                  <ColorGrid selected={formColor} onChange={setFormColor} />
                  {formColor && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1.5 text-xs text-subtle hover:text-base transition-colors"
                      onClick={() => setFormColor('')}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                      Remove color
                    </button>
                  )}
                </div>

                {/* Action button */}
                <button
                  type="button"
                  className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 transition-colors disabled:opacity-50"
                  onClick={() => void (view === 'create' ? handleCreate() : handleSaveEdit())}
                  disabled={saving || !formName.trim()}
                >
                  {saving ? 'Saving…' : null}
                  {!saving && view === 'create' ? 'Create' : null}
                  {!saving && view !== 'create' ? 'Save' : null}
                </button>

                {/* Delete — only on edit view */}
                {isEditView && !confirmDelete && (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-danger/40 text-danger hover:bg-danger/10 text-sm py-2 transition-colors"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete label
                  </button>
                )}

                {/* Confirmation prompt */}
                {isEditView && confirmDelete && (
                  <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 space-y-2">
                    <p className="text-xs text-danger font-medium">Delete this label?</p>
                    <p className="text-xs text-muted">
                      This will permanently remove the label from all cards. This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-danger hover:bg-red-700 text-white text-sm py-1.5 transition-colors disabled:opacity-50"
                        onClick={() => void handleDeleteLabel()}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-bg-overlay hover:bg-bg-sunken text-sm text-base py-1.5 transition-colors"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};

export default BoardLabelsPanel;
