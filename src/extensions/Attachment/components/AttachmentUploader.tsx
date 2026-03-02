// AttachmentUploader — drag-and-drop zone that initiates the three-step S3 upload flow.
// Progress is tracked via XMLHttpRequest's progress event (no third-party library).
import React, { useRef, useState } from 'react';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';

interface Props {
  cardId: string;
  onUploadComplete: () => void;
}

export function AttachmentUploader({ cardId, onUploadComplete }: Props): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { upload, progress, error } = useAttachmentUpload({ cardId, onComplete: onUploadComplete });

  const handleFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    upload({ file });
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? '#6366f1' : '#d1d5db'}`,
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        cursor: 'pointer',
        color: '#6b7280',
        fontSize: 14,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {progress !== null ? (
        <div>
          <div style={{ marginBottom: 8 }}>Uploading… {progress}%</div>
          <progress value={progress} max={100} style={{ width: '100%' }} />
        </div>
      ) : (
        <span>Drop a file here or click to browse</span>
      )}
      {error && <div style={{ color: '#ef4444', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
