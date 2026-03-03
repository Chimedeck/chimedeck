// AttachmentItem — renders a single attachment row with name, status, and actions.
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AttachmentStatusBadge } from './AttachmentStatusBadge';

interface Attachment {
  id: string;
  name: string;
  type: 'FILE' | 'URL';
  status: 'PENDING' | 'READY' | 'REJECTED';
  url?: string;
}

interface Props {
  attachment: Attachment;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
}

export function AttachmentItem({ attachment, onDelete, onDownload }: Props): React.ReactElement {
  const handleDownload = (): void => {
    if (attachment.type === 'URL' && attachment.url) {
      window.open(attachment.url, '_blank', 'noopener,noreferrer');
    } else if (attachment.type === 'FILE' && attachment.status === 'READY') {
      onDownload(attachment.id);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
      <span style={{ flex: 1, fontSize: 14 }}>{attachment.name}</span>
      {attachment.type === 'FILE' && <AttachmentStatusBadge status={attachment.status} />}
      {(attachment.type === 'URL' || attachment.status === 'READY') && (
        <button onClick={handleDownload} style={{ fontSize: 12, cursor: 'pointer' }}>
          {attachment.type === 'URL' ? 'Open' : 'Download'}
        </button>
      )}
      <button
        onClick={() => onDelete(attachment.id)}
        style={{ fontSize: 12, color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none' }}
        aria-label="Delete attachment"
      >
        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
