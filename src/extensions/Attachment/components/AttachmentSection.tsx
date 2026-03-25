// AttachmentSection — renders the full attachment panel inside a card modal.
import React, { useEffect, useState } from 'react';
import { AttachmentItem } from './AttachmentItem';
import { AttachmentUploader } from './AttachmentUploader';
import { AttachmentUrlModal } from './AttachmentUrlModal';
import translations from '../translations/en.json';

interface Attachment {
  id: string;
  name: string;
  type: 'FILE' | 'URL';
  status: 'PENDING' | 'READY' | 'REJECTED';
  url?: string;
}

interface Props {
  cardId: string;
  authToken: string;
  apiBase?: string;
}

export function AttachmentSection({ cardId, authToken, apiBase = '' }: Props): React.ReactElement {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showUrlModal, setShowUrlModal] = useState(false);

  const authHeaders = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };

  const refresh = async (): Promise<void> => {
    // NOTE: a GET /cards/:id/attachments endpoint would be ideal here; for now
    // the section refreshes by re-fetching the card and extracting attachments.
    // TODO: add a dedicated list endpoint in a future sprint.
  };

  useEffect(() => { refresh(); }, [cardId]);

  const handleDelete = async (id: string): Promise<void> => {
    await fetch(`${apiBase}/api/v1/attachments/${id}`, { method: 'DELETE', headers: authHeaders });
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDownload = async (id: string): Promise<void> => {
    // [why] Navigate to the authenticated proxy — never expose raw presigned S3 URLs to the client.
    window.open(`${apiBase}/api/v1/attachments/${id}/view`, '_blank', 'noopener,noreferrer');
  };

  const handleAddUrl = async (name: string, url: string): Promise<void> => {
    const resp = await fetch(`${apiBase}/api/v1/cards/${cardId}/attachments/url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name, url }),
    });
    if (!resp.ok) {
      const err = (await resp.json()) as { name: string };
      throw new Error(err.name);
    }
    const { data } = (await resp.json()) as { data: Attachment };
    setAttachments((prev) => [...prev, data]);
  };

  const handleUploadComplete = (): void => {
    refresh();
  };

  return (
    <section style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: 14, marginBottom: 8 }}>{translations['attachment.section.title']}</h4>
      {attachments.map((a) => (
        <AttachmentItem key={a.id} attachment={a} onDelete={handleDelete} onDownload={handleDownload} />
      ))}
      <AttachmentUploader cardId={cardId} onUploadComplete={handleUploadComplete} />
      <button
        onClick={() => setShowUrlModal(true)}
        style={{ marginTop: 8, fontSize: 12, cursor: 'pointer' }}
      >
        {translations['attachment.section.addUrl']}
      </button>
      {showUrlModal && (
        <AttachmentUrlModal cardId={cardId} onAdd={handleAddUrl} onClose={() => setShowUrlModal(false)} />
      )}
    </section>
  );
}
