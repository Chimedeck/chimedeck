// Centralised MIME-type allowlist and size cap for attachment uploads.
// Update this file to permit additional file types — avoid scattering allow-lists.
import { env } from '../../../config/env';

export const ALLOWED_MIME_TYPES: string[] = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Text
  'text/plain',
  'text/csv',
  'text/markdown',
  // Archives
  'application/zip',
  'application/x-tar',
  'application/gzip',
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',     // .mov
  'video/x-msvideo',     // .avi
  'video/x-matroska',   // .mkv
  'video/mpeg',
  'video/3gpp',
  'video/3gpp2',
  'video/x-flv',
  // Audio
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
];

/** Hard cap driven by MAX_ATTACHMENT_SIZE_MB env var (default 50 MB). */
export const MAX_FILE_SIZE_BYTES = env.MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
