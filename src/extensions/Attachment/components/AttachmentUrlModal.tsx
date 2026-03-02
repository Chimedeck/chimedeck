// AttachmentUrlModal — form for adding an external URL attachment.
import React, { useState } from 'react';

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
      setError('Both name and URL are required.');
      return;
    }
    setSubmitting(true);
    try {
      await onAdd(name.trim(), url.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to add URL.');
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
        <h3 style={{ margin: 0, fontSize: 16 }}>Add URL attachment</h3>
        <label style={{ fontSize: 13 }}>
          Label
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>
        {error && <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" disabled={submitting}>{submitting ? 'Adding…' : 'Add'}</button>
        </div>
      </form>
    </div>
  );
}
