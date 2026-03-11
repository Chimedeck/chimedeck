// Maps a MIME type string to a Heroicon React component for display in the UI.
// Falls back to DocumentIcon for unknown types.
import {
  PhotoIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ArchiveBoxIcon,
  FilmIcon,
  MusicalNoteIcon,
  DocumentIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

const MIME_MAP: Array<{ test: (mime: string) => boolean; icon: HeroIcon }> = [
  { test: (m) => m.startsWith('image/'), icon: PhotoIcon },
  { test: (m) => m === 'application/pdf', icon: DocumentTextIcon },
  {
    test: (m) =>
      m === 'application/vnd.ms-excel' ||
      m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      m === 'text/csv',
    icon: TableCellsIcon,
  },
  {
    test: (m) =>
      m === 'application/zip' ||
      m === 'application/x-zip-compressed' ||
      m === 'application/x-tar' ||
      m === 'application/gzip' ||
      m === 'application/x-7z-compressed' ||
      m === 'application/x-rar-compressed',
    icon: ArchiveBoxIcon,
  },
  { test: (m) => m.startsWith('video/'), icon: FilmIcon },
  { test: (m) => m.startsWith('audio/'), icon: MusicalNoteIcon },
];

export function getMimeIcon(mimeType: string | null): HeroIcon {
  if (!mimeType) return DocumentIcon;
  for (const entry of MIME_MAP) {
    if (entry.test(mimeType)) return entry.icon;
  }
  return DocumentIcon;
}

/** Returns LinkIcon for URL-type attachments (convenience export). */
export { LinkIcon as urlIcon };
