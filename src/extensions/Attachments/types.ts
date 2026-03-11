// TypeScript types for the Attachments feature (Sprint 60).

export type AttachmentStatus = 'PENDING' | 'SCANNING' | 'READY' | 'REJECTED';
export type AttachmentType = 'FILE' | 'URL';

export interface Attachment {
  id: string;
  card_id: string;
  name: string;
  type: AttachmentType;
  status: AttachmentStatus;
  /** S3 object key (null for URL type) */
  key: string | null;
  /** Thumbnail S3 key — set for image/* attachments after thumbnail generation */
  thumbnail_key: string | null;
  /** MIME type reported at upload time */
  content_type: string | null;
  /** File size in bytes */
  size_bytes: number | null;
  /** Image dimensions (set after thumbnail generation) */
  width: number | null;
  height: number | null;
  /** Pre-signed download URL (expires 1h, included in GET /attachments response) */
  url: string | null;
  /** Pre-signed thumbnail URL (expires 1h, image/* only) */
  thumbnail_url: string | null;
  /** External URL for URL-type attachments */
  external_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Upload URL ----------

export interface UploadUrlRequest {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadUrlResponse {
  attachmentId: string;
  uploadUrl: string;
  key: string;
}

// ---------- Confirm upload ----------

export interface ConfirmUploadRequest {
  attachmentId: string;
}

// ---------- Multipart ----------

export interface MultipartStartRequest {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MultipartStartResponse {
  attachmentId: string;
  uploadId: string;
  key: string;
}

export interface PartUrlRequest {
  uploadId: string;
  key: string;
  partNumber: number;
}

export interface PartUrlResponse {
  url: string;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export interface MultipartCompleteRequest {
  uploadId: string;
  key: string;
  attachmentId: string;
  parts: CompletedPart[];
}

// ---------- URL attachment ----------

export interface UrlAttachmentRequest {
  type: 'URL';
  url: string;
  name: string;
}

// ---------- In-flight upload state (client-only) ----------

export type UploadPhase =
  | 'requesting-url'
  | 'uploading'
  | 'confirming'
  | 'done'
  | 'error';

export interface UploadEntry {
  /** Temporary client-side id (before server assigns real id) */
  clientId: string;
  file: File;
  phase: UploadPhase;
  /** 0–100 during 'uploading' phase */
  progress: number;
  error: string | null;
  /** Server-assigned id once confirmed */
  attachmentId: string | null;
}
