// Centralised MIME-type allowlist and size cap for attachment uploads.
// Update this file to permit additional file types — avoid scattering allow-lists.
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
  // Video (stored but no preview)
  'video/mp4',
  'video/webm',
  // Audio
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
];

/** 100 MB hard cap — applies to both single-file and multipart uploads. */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
