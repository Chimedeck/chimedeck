// Attachment API functions — all endpoints for list, upload, confirm, multipart, delete.
// Uses the shared apiClient (axios) so auth headers are injected automatically.
import apiClient from '~/common/api/client';
import type {
  Attachment,
  UploadUrlRequest,
  UploadUrlResponse,
  ConfirmUploadRequest,
  MultipartStartRequest,
  MultipartStartResponse,
  PartUrlRequest,
  PartUrlResponse,
  MultipartCompleteRequest,
  UrlAttachmentRequest,
  PatchAttachmentRequest,
} from './types';

// ---------- List ----------

export async function listAttachments({ cardId }: { cardId: string }): Promise<{ data: Attachment[] }> {
  return apiClient.get(`/cards/${cardId}/attachments`);
}

// ---------- Single-file upload ----------

export async function requestUploadUrl({
  cardId,
  filename,
  mimeType,
  sizeBytes,
}: { cardId: string } & UploadUrlRequest): Promise<{ data: UploadUrlResponse }> {
  return apiClient.post(`/cards/${cardId}/attachments/upload-url`, { filename, mimeType, sizeBytes });
}

export async function confirmUpload({
  cardId,
  attachmentId,
}: { cardId: string } & ConfirmUploadRequest): Promise<{ data: Attachment }> {
  return apiClient.post(`/cards/${cardId}/attachments`, { attachmentId });
}

// ---------- Multipart upload ----------

export async function startMultipart({
  cardId,
  filename,
  mimeType,
  sizeBytes,
}: { cardId: string } & MultipartStartRequest): Promise<{ data: MultipartStartResponse }> {
  return apiClient.post(`/cards/${cardId}/attachments/multipart/start`, { filename, mimeType, sizeBytes });
}

export async function getPartUrl({
  cardId,
  uploadId,
  key,
  partNumber,
}: { cardId: string } & PartUrlRequest): Promise<{ data: PartUrlResponse }> {
  return apiClient.post(`/cards/${cardId}/attachments/multipart/part-url`, { uploadId, key, partNumber });
}

export async function completeMultipart({
  cardId,
  uploadId,
  key,
  attachmentId,
  parts,
}: { cardId: string } & MultipartCompleteRequest): Promise<{ data: Attachment }> {
  return apiClient.post(`/cards/${cardId}/attachments/multipart/complete`, {
    uploadId,
    key,
    attachmentId,
    parts,
  });
}

export async function abortMultipart({
  cardId,
  uploadId,
}: {
  cardId: string;
  uploadId: string;
}): Promise<void> {
  return apiClient.delete(`/cards/${cardId}/attachments/multipart/${uploadId}`);
}

// ---------- URL attachment ----------

export async function createUrlAttachment({
  cardId,
  url,
  name,
}: { cardId: string } & Omit<UrlAttachmentRequest, 'type'>): Promise<{ data: Attachment }> {
  return apiClient.post(`/cards/${cardId}/attachments/url`, { url, name });
}

// Fetch minimal card info for the paste-URL preview (form-time detection).
export async function fetchCardPreview({ cardId }: { cardId: string }): Promise<{
  data: { id: string; title: string };
  includes: {
    board: { id: string; title: string };
    list: { id: string; title: string };
    labels: Array<{ id: string; name: string; color: string }>;
  };
}> {
  return apiClient.get(`/cards/${cardId}`);
}

// ---------- Link preview ----------

export async function fetchLinkPreview({ url }: { url: string }): Promise<{ data: { title: string; faviconUrl: string } }> {
  return apiClient.get(`/link-preview?url=${encodeURIComponent(url)}`);
}

// ---------- Delete ----------

export async function deleteAttachment({
  cardId: _cardId,
  attachmentId,
}: {
  cardId: string;
  attachmentId: string;
}): Promise<void> {
  return apiClient.delete(`/attachments/${attachmentId}`);
}

// ---------- Patch (alias update) ----------

export async function patchAttachment({
  attachmentId,
  alias,
}: { attachmentId: string } & PatchAttachmentRequest): Promise<{ data: Attachment }> {
  return apiClient.patch(`/attachments/${attachmentId}`, { alias });
}
