// BackgroundPicker — upload or remove a board background image.
// Rendered for Owner/Admin/Member; caller is responsible for role-gating.
import { useRef, useState } from 'react';
import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { selectAuthToken } from '~/extensions/Auth/duck/authDuck';
import { selectBoard, boardSliceActions } from '../../slices/boardSlice';
import { uploadBoardBackground, deleteBoardBackground } from '../../api';

interface Props {
  boardId: string;
}

const BackgroundPicker = ({ boardId }: Props) => {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken) ?? '';
  const board = useAppSelector(selectBoard);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await uploadBoardBackground({ boardId, file, token });
      dispatch(boardSliceActions.updateBoardBackground({ background: res.data.background ?? null }));
    } catch (err: unknown) {
      const e = err as { name?: string };
      setError(e?.name ?? 'upload-failed');
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setError(null);
    setRemoving(true);
    try {
      await deleteBoardBackground({ boardId, token });
      dispatch(boardSliceActions.updateBoardBackground({ background: null }));
    } catch (err: unknown) {
      const e = err as { name?: string };
      setError(e?.name ?? 'remove-failed');
    } finally {
      setRemoving(false);
    }
  };

  const currentBackground = (board as { background?: string | null } | null)?.background;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Background
      </p>

      {/* Current background preview */}
      {currentBackground ? (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img
            src={currentBackground}
            alt="Board background"
            className="w-full h-20 object-cover"
          />
          <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
        </div>
      ) : (
        <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-muted text-xs">
          No background set
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          id="bg-upload-input"
          onChange={handleFileChange}
          disabled={uploading || removing}
        />
        <label
          htmlFor="bg-upload-input"
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-subtle transition-colors hover:bg-bg-overlay ${
            uploading || removing ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <PhotoIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {uploading ? 'Uploading…' : 'Upload image'}
        </label>

        {currentBackground && (
          <button
            onClick={handleRemove}
            disabled={uploading || removing}
            className="flex items-center gap-1.5 rounded-md border border-red-700 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-red-900/30 disabled:opacity-50"
            aria-label="Remove background"
          >
            <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {removing ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      <p className="text-xs text-muted">
        JPEG or PNG, max 10 MB
      </p>
    </div>
  );
};

export default BackgroundPicker;
