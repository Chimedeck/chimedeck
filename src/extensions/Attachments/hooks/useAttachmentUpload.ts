// useAttachmentUpload — orchestrates single-file (≤5 MB, XHR onprogress) and
// multipart (>5 MB, up to 3 concurrent parts) upload flows.
import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  requestUploadUrl,
  confirmUpload,
  startMultipart,
  getPartUrl,
  completeMultipart,
  abortMultipart,
} from '../api';
import type { Attachment, UploadEntry, CompletedPart } from '../types';
import config from '~/config';

const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const PART_SIZE = 5 * 1024 * 1024;           // 5 MB per part
const MAX_CONCURRENT_PARTS = 3;

interface UseAttachmentUploadOptions {
  cardId: string;
  /** Called when an upload fully completes. Receives the server-confirmed Attachment payload. */
  onSuccess?: (attachment: Attachment) => void;
  onError?: (clientId: string, message: string) => void;
}

interface UseAttachmentUploadReturn {
  uploads: UploadEntry[];
  upload: (files: File[]) => void;
  removeEntry: (clientId: string) => void;
}

// Upload a file via a single pre-signed PUT, reporting XHR progress.
function singleFileUpload(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 PUT failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

// Upload a single part via PUT and return its ETag.
async function uploadPart(url: string, slice: Blob): Promise<string> {
  const res = await fetch(url, {
    method: 'PUT',
    body: slice,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`Part upload failed: ${res.status}`);
  return res.headers.get('ETag') ?? '';
}

// Run tasks with limited concurrency.
async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const current = idx++;
      const task = tasks[current];
      if (task) results[current] = await task();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export function useAttachmentUpload({
  cardId,
  onSuccess,
  onError,
}: UseAttachmentUploadOptions): UseAttachmentUploadReturn {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  // Abort controllers keyed by clientId for cancellation support
  const abortRefs = useRef<Record<string, AbortController>>({});

  const updateEntry = useCallback((clientId: string, patch: Partial<UploadEntry>) => {
    setUploads((prev) =>
      prev.map((e) => (e.clientId === clientId ? { ...e, ...patch } : e)),
    );
  }, []);

  const upload = useCallback(
    (files: File[]) => {
      const validFiles = files.filter((file) => {
        if (file.size > config.maxAttachmentSizeBytes) {
          onError?.('', `"${file.name}" exceeds the ${config.maxAttachmentSizeBytes / 1024 / 1024} MB size limit`);
          return false;
        }
        return true;
      });

      const newEntries: UploadEntry[] = validFiles.map((file) => ({
        clientId: uuidv4(),
        file,
        phase: 'requesting-url',
        progress: 0,
        error: null,
        attachmentId: null,
      }));

      setUploads((prev) => [...prev, ...newEntries]);

      for (const entry of newEntries) {
        void uploadFile(entry);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardId],
  );

  async function uploadFile(entry: UploadEntry): Promise<void> {
    const { clientId, file } = entry;
    const ac = new AbortController();
    abortRefs.current[clientId] = ac;

    try {
      if (file.size <= MULTIPART_THRESHOLD) {
        await doSingleUpload(clientId, file, ac.signal);
      } else {
        await doMultipartUpload(clientId, file, ac.signal);
      }
    } catch (err: unknown) {
      if (ac.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Upload failed';
      updateEntry(clientId, { phase: 'error', error: msg });
      onError?.(clientId, msg);
    } finally {
      delete abortRefs.current[clientId];
    }
  }

  async function doSingleUpload(
    clientId: string,
    file: File,
    signal: AbortSignal,
  ): Promise<void> {
    updateEntry(clientId, { phase: 'requesting-url' });

    const { data: urlData } = await requestUploadUrl({
      cardId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    });

    if (signal.aborted) return;

    updateEntry(clientId, { phase: 'uploading', progress: 0 });

    await singleFileUpload(urlData.uploadUrl, file, (pct) => {
      if (!signal.aborted) updateEntry(clientId, { progress: pct });
    });

    if (signal.aborted) return;

    updateEntry(clientId, { phase: 'confirming', progress: 100 });

    const { data: attachment } = await confirmUpload({
      cardId,
      attachmentId: urlData.attachmentId,
    });

    updateEntry(clientId, { phase: 'done', attachmentId: attachment.id });
    onSuccess?.(attachment);
  }

  async function doMultipartUpload(
    clientId: string,
    file: File,
    signal: AbortSignal,
  ): Promise<void> {
    updateEntry(clientId, { phase: 'requesting-url' });

    const { data: mpData } = await startMultipart({
      cardId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    });

    if (signal.aborted) return;

    const totalParts = Math.ceil(file.size / PART_SIZE);
    let completedCount = 0;

    const partTasks: (() => Promise<CompletedPart>)[] = Array.from(
      { length: totalParts },
      (_, i) => async (): Promise<CompletedPart> => {
        const partNumber = i + 1;
        const slice = file.slice(i * PART_SIZE, partNumber * PART_SIZE);

        const { data: partUrlData } = await getPartUrl({
          cardId,
          uploadId: mpData.uploadId,
          key: mpData.key,
          partNumber,
        });

        const etag = await uploadPart(partUrlData.url, slice);

        completedCount++;
        const pct = Math.round((completedCount / totalParts) * 100);
        if (!signal.aborted) updateEntry(clientId, { phase: 'uploading', progress: pct });

        return { partNumber, etag };
      },
    );

    updateEntry(clientId, { phase: 'uploading', progress: 0 });

    let parts: CompletedPart[];
    try {
      parts = await runConcurrent(partTasks, MAX_CONCURRENT_PARTS);
    } catch (err) {
      // Abort the multipart upload on error
      await abortMultipart({ cardId, uploadId: mpData.uploadId }).catch(() => {});
      throw err;
    }

    if (signal.aborted) {
      await abortMultipart({ cardId, uploadId: mpData.uploadId }).catch(() => {});
      return;
    }

    updateEntry(clientId, { phase: 'confirming', progress: 100 });

    const { data: attachment } = await completeMultipart({
      cardId,
      uploadId: mpData.uploadId,
      key: mpData.key,
      attachmentId: mpData.attachmentId,
      parts,
    });

    updateEntry(clientId, { phase: 'done', attachmentId: attachment.id });
    onSuccess?.(attachment);
  }

  const removeEntry = useCallback((clientId: string) => {
    abortRefs.current[clientId]?.abort();
    setUploads((prev) => prev.filter((e) => e.clientId !== clientId));
  }, []);

  return { uploads, upload, removeEntry };
}
