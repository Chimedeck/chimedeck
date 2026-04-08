// GenerateTokenModal — form to create a new API token with name + optional expiry.
import { useState } from 'react';
import type { CreateTokenBody } from '../../apiToken.slice';
import Button from '~/common/components/Button';
import translations from '../../translations/en.json';

interface Props {
  onSubmit: (body: CreateTokenBody) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function GenerateTokenModal({ onSubmit, onCancel, isLoading }: Props) {
  const [name, setName] = useState('');
  const [noExpiry, setNoExpiry] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      expiresAt: noExpiry ? null : expiresAt || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-bg-surface p-6 shadow-2xl">
        <h2 className="mb-5 text-lg font-semibold text-base">
          {translations['GenerateTokenModal.title']}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-subtle">
              {translations['GenerateTokenModal.nameLabel']}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={translations['GenerateTokenModal.namePlaceholder']}
              required
              className="w-full rounded-lg bg-bg-overlay px-3 py-2 text-sm text-base border border-border focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-subtle"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-subtle">
              {translations['GenerateTokenModal.expiryLabel']}
            </label>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                id="no-expiry"
                checked={noExpiry}
                onChange={(e) => setNoExpiry(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-bg-base text-blue-600"
              />
              <label htmlFor="no-expiry" className="text-sm text-subtle">
                {translations['GenerateTokenModal.noExpiry']}
              </label>
            </div>
            {!noExpiry && (
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg bg-bg-overlay px-3 py-2 text-sm text-base border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onCancel}
              disabled={isLoading}
            >
              {translations['GenerateTokenModal.cancel']}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isLoading || !name.trim()}
            >
              {translations['GenerateTokenModal.submit']}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
