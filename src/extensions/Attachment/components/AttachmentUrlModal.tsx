// AttachmentUrlModal — form for adding an external URL attachment.
import React, { useState } from 'react';
import translations from '../translations/en.json';

interface Props {
  cardId: string;
  onAdd: (name: string, url: string) => Promise<void>;
  onClose: () => void;
}

export function AttachmentUrlModal({ onAdd, onClose }: Props): React.ReactElement {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !url.trim()) {
      setError(translations['attachment.urlModal.error.required']);
      return;
    }
    setSubmitting(true);
    try {
      await onAdd(name.trim(), url.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message ?? translations['attachment.urlModal.error.failed']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>{translations['attachment.urlModal.title']}</h3>
        <label style={{ fontSize: 13 }}>
          {translations['attachment.urlModal.label']}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          {translations['attachment.urlModal.url']}
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>
        {error && <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={submitting}>{translations['attachment.urlModal.cancel']}</button>
          <button type="submit" disabled={submitting}>{submitting ? translations['attachment.urlModal.submitting'] : translations['attachment.urlModal.submit']}</button>
        </div>
      </form>
    </div>
  );
}
