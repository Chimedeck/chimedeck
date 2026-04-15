// WebhookCreatedModal — one-time signing secret reveal after webhook registration.
// The secret is shown once; copy-to-clipboard button resets to default label after 2s.
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';
import translations from '../../translations/en.json';

interface Props {
  signingSecret: string;
  onClose: () => void;
}

export default function WebhookCreatedModal({ signingSecret, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(signingSecret);
      setCopied(true);
      // [why] Reset label after 2s so the user knows the button is ready for another copy.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail — clipboard may be unavailable in some environments
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webhook-created-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md rounded-lg bg-bg-surface shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 id="webhook-created-title" className="text-base font-semibold text-text-primary">
            {translations['WebhookCreatedModal.title']}
          </h3>
          <IconButton
            aria-label="Close modal"
            icon={<XMarkIcon className="h-4 w-4" />}
            variant="ghost"
            onClick={onClose}
          />
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Success banner */}
          <div className="rounded-md bg-success/10 px-4 py-3">
            <p className="text-sm font-medium text-success">
              {translations['WebhookCreatedModal.successBanner']}
            </p>
          </div>

          {/* Signing secret */}
          <div>
            <p className="mb-1 text-sm font-medium text-muted">
              {translations['WebhookCreatedModal.secretLabel']}
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 rounded-md border border-border bg-bg-overlay px-3 py-2 font-mono text-xs text-text-primary break-all"
                data-testid="signing-secret"
              >
                {signingSecret}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                data-testid="copy-button"
              >
                {copied
                  ? translations['WebhookCreatedModal.copiedButton']
                  : translations['WebhookCreatedModal.copyButton']}
              </Button>
            </div>
          </div>

          {/* Warning callout */}
          <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
            <p className="text-sm text-warning">
              {translations['WebhookCreatedModal.secretWarning']}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button type="button" variant="primary" onClick={onClose} data-testid="done-button">
            {translations['WebhookCreatedModal.done']}
          </Button>
        </div>
      </div>
    </div>
  );
}
