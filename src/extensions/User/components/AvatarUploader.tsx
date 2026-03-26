// AvatarUploader — click or drag-and-drop to upload a new avatar image.
// Shows current avatar or initials placeholder; includes a remove button.
import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  uploadAvatarThunk,
  removeAvatarThunk,
  selectAvatarUploading,
} from '../containers/ProfilePage/ProfilePage.duck';
import translations from '../translations/en.json';

interface AvatarUploaderProps {
  avatarUrl: string | null;
  name: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;

export default function AvatarUploader({ avatarUrl, name }: AvatarUploaderProps) {
  const dispatch = useAppDispatch();
  const uploading = useAppSelector(selectAvatarUploading);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function validateAndUpload(file: File) {
    setLocalError(null);
    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      setLocalError(translations['ProfilePage.invalidFile']);
      return;
    }
    dispatch(uploadAvatarThunk({ file }));
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndUpload(file);
  }

  function handleRemove() {
    dispatch(removeAvatarThunk());
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {/* Avatar display + drop zone */}
      <div
        className={`relative cursor-pointer rounded-full border-2 transition-colors ${
          dragOver ? 'border-indigo-400 bg-bg-overlay' : 'border-border bg-bg-surface'
        }`}
        style={{ width: 128, height: 128 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload avatar"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-indigo-600 text-3xl font-bold text-white">
            {getInitials(name) || '?'}
          </span>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <span className="text-sm text-base">Uploading…</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
        >
          {translations['ProfilePage.changePhoto']}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="text-sm text-muted hover:text-red-400 disabled:opacity-50"
          >
            {translations['ProfilePage.removePhoto']}
          </button>
        )}
      </div>

      {localError && (
        <p className="text-sm text-red-400" role="alert">{localError}</p>
      )}
    </div>
  );
}
