// useAttachmentUpload — orchestrates the three-step S3 upload flow:
// 1. POST /cards/:id/attachments/upload-url  → get pre-signed PUT URL
// 2. PUT <uploadUrl> directly to S3 (progress via XHR)
// 3. POST /cards/:id/attachments  → confirm upload + enqueue virus scan
import { useState } from 'react';

interface Options {
  cardId: string;
  onComplete: () => void;
  authToken?: string;
  apiBase?: string;
}

interface UploadState {
  upload: (args: { file: File }) => void;
  progress: number | null;
  error: string | null;
}

export function useAttachmentUpload({ cardId, onComplete, authToken = '', apiBase = '' }: Options): UploadState {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = ({ file }: { file: File }): void => {
    setError(null);
    setProgress(0);

    const authHeaders = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };

    // Step 1: request pre-signed PUT URL
    fetch(`${apiBase}/api/v1/cards/${cardId}/attachments/upload-url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size }),
    })
      .then(async (resp) => {
        if (!resp.ok) {
          const err = (await resp.json()) as { name: string };
          throw new Error(err.name);
        }
        return resp.json() as Promise<{ data: { attachmentId: string; uploadUrl: string } }>;
      })
      .then(({ data: { attachmentId, uploadUrl } }) =>
        // Step 2: upload directly to S3 via XHR to track progress
        new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(attachmentId);
            } else {
              reject(new Error(`S3 upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
          xhr.send(file);
        }),
      )
      .then(async (attachmentId) => {
        // Step 3: confirm upload
        const resp = await fetch(`${apiBase}/api/v1/cards/${cardId}/attachments`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ attachmentId }),
        });
        if (!resp.ok) {
          const err = (await resp.json()) as { name: string };
          throw new Error(err.name);
        }
      })
      .then(() => {
        setProgress(null);
        onComplete();
      })
      .catch((err: Error) => {
        setProgress(null);
        setError(err.message);
      });
  };

  return { upload, progress, error };
}
