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
  deleteAttachment,
} from '../api';
import type { Attachment, UploadEntry, CompletedPart } from '../types';
import config from '~/config';

const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5 MB
const PART_SIZE = 5 * 1024 * 1024;           // 5 MB per part
const MAX_CONCURRENT_PARTS = 3;

interface UseAttachmentUploadOptions {
  cardId: string;
  /**
   * When true, `upload()` queues files locally (phase: 'pending') without starting
   * the actual upload. Call `flush()` to start all queued uploads.
   * Use this in draft editors so files are only uploaded on submit.
   */
  deferred?: boolean;
  /** Called when an upload fully completes. Receives the server-confirmed Attachment payload and the client-side tracking id. */
  onSuccess?: (attachment: Attachment, clientId: string) => void;
  onError?: (clientId: string, message: string) => void;
}

interface UseAttachmentUploadReturn {
  uploads: UploadEntry[];
  /** Starts uploads (or queues them when deferred=true) and returns the generated client-side ids for position tracking. */
  upload: (files: File[]) => string[];
  removeEntry: (clientId: string) => void;
  /**
   * Only meaningful when `deferred: true`.
   * Starts all queued (phase: 'pending') uploads and returns a Promise that
   * resolves when every upload has reached 'done' or 'error'.
   */
  flush: () => Promise<void>;
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
  deferred = false,
  onSuccess,
  onError,
}: UseAttachmentUploadOptions): UseAttachmentUploadReturn {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  // Abort controllers keyed by clientId for cancellation support
  const abortRefs = useRef<Record<string, AbortController>>({});
  // [why] Tracks entries queued in deferred mode so flush() can start them
  // without needing to read state inside the Promise constructor (avoids deep nesting).
  const deferredEntriesRef = useRef<UploadEntry[]>([]);
  // [why] Used by flush() to resolve once all in-flight deferred uploads complete.
  const flushResolverRef = useRef<{ remaining: number; resolve: () => void } | null>(null);
  // [why] Use refs so inner async functions always invoke the latest callback version
  // without needing to be re-created on every render (prevents stale closures).
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const updateEntry = useCallback((clientId: string, patch: Partial<UploadEntry>) => {
    setUploads((prev) =>
      prev.map((e) => (e.clientId === clientId ? { ...e, ...patch } : e)),
    );
  }, []);

  const upload = useCallback(
    (files: File[]) => {
      const validFiles = files.filter((file) => {
        if (file.size > config.maxAttachmentSizeBytes) {
          const maxSizeMb = Math.round(config.maxAttachmentSizeBytes / (1024 * 1024));
          onErrorRef.current?.('', `File "${file.name}" is too large. It must be under ${maxSizeMb}MB.`);
          return false;
        }
        return true;
      });

      const newEntries: UploadEntry[] = validFiles.map((file) => ({
        clientId: uuidv4(),
        file,
        // [why] In deferred mode entries sit as 'pending' until flush() is called.
        phase: deferred ? 'pending' : 'requesting-url',
        progress: 0,
        error: null,
        attachmentId: null,
      }));

      setUploads((prev) => [...prev, ...newEntries]);

      if (deferred) {
        deferredEntriesRef.current = [...deferredEntriesRef.current, ...newEntries];
      } else {
        for (const entry of newEntries) {
          void uploadFile(entry);
        }
      }

      return newEntries.map((e) => e.clientId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardId, deferred],
  );

  // [why] flush() starts all 'pending' entries (deferred mode) and returns a
  // Promise that resolves once every upload reaches 'done' or 'error'. This lets
  // submit handlers await all uploads before sending the comment content.
  const flush = useCallback((): Promise<void> => {
    const pendingEntries = deferredEntriesRef.current;
    deferredEntriesRef.current = [];
    if (pendingEntries.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      flushResolverRef.current = { remaining: pendingEntries.length, resolve };
      for (const entry of pendingEntries) {
        void uploadFile(entry);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notifyFlushComplete() {
    const resolver = flushResolverRef.current;
    if (!resolver) return;
    resolver.remaining -= 1;
    if (resolver.remaining <= 0) {
      resolver.resolve();
      flushResolverRef.current = null;
    }
  }

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
      onErrorRef.current?.(clientId, msg);
      // Remove failed inline rows so they don't linger in "uploading" state.
      setUploads((prev) => prev.filter((e) => e.clientId !== clientId));
    } finally {
      delete abortRefs.current[clientId];
      // [why] Notify any active flush() Promise that one more upload has settled.
      notifyFlushComplete();
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

    try {
      await singleFileUpload(urlData.uploadUrl, file, (pct) => {
        if (!signal.aborted) updateEntry(clientId, { progress: pct });
      });
    } catch (error) {
      // Remove orphaned PENDING attachment row created by upload-url request.
      await deleteAttachment({ cardId, attachmentId: urlData.attachmentId }).catch(() => {});
      throw error;
    }

    if (signal.aborted) return;

    updateEntry(clientId, { phase: 'confirming', progress: 100 });

    const { data: attachment } = await confirmUpload({
      cardId,
      attachmentId: urlData.attachmentId,
    });

    updateEntry(clientId, { phase: 'done', attachmentId: attachment.id });
    onSuccessRef.current?.(attachment, clientId);
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
      await abortMultipart({ cardId, uploadId: mpData.uploadId, key: mpData.key }).catch(() => {});
      throw err;
    }

    if (signal.aborted) {
      await abortMultipart({ cardId, uploadId: mpData.uploadId, key: mpData.key }).catch(() => {});
      return;
    }

    updateEntry(clientId, { phase: 'confirming', progress: 100 });

    let attachment: Attachment;
    try {
      const result = await completeMultipart({
        cardId,
        uploadId: mpData.uploadId,
        key: mpData.key,
        attachmentId: mpData.attachmentId,
        parts,
      });
      attachment = result.data;
    } catch (error) {
      // Complete can fail after parts upload; abort to clear pending server row.
      await abortMultipart({ cardId, uploadId: mpData.uploadId, key: mpData.key }).catch(() => {});
      throw error;
    }

    updateEntry(clientId, { phase: 'done', attachmentId: attachment.id });
    onSuccessRef.current?.(attachment, clientId);
  }

  const removeEntry = useCallback((clientId: string) => {
    abortRefs.current[clientId]?.abort();
    setUploads((prev) => prev.filter((e) => e.clientId !== clientId));
  }, []);

  return { uploads, upload, removeEntry, flush };
}
