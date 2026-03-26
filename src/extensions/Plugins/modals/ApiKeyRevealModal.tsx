// One-time display of the newly generated API key after plugin registration.
// The key is never shown again once this modal is dismissed.
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../common/components/Button';
import translations from '../translations/en.json';

interface Props {
  apiKey: string;
  onClose: () => void;
}

const ApiKeyRevealModal = ({ apiKey, onClose }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
    }
  }, [apiKey]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={translations['plugins.apiKeyModal.ariaLabel']}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-bg-base rounded-lg shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{translations['plugins.apiKeyModal.title']}</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 text-yellow-300 text-sm flex gap-2">
            <span>{translations['plugins.apiKeyModal.warningPrefix']}</span>
            <span>{translations['plugins.apiKeyModal.warning']}</span>
          </div>

          <div className="flex gap-2 items-stretch">
            <code className="flex-1 bg-bg-surface border border-border rounded px-3 py-2 text-sm text-green-300 font-mono break-all">
              {apiKey}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 bg-bg-overlay hover:bg-bg-sunken text-subtle text-sm rounded px-3 py-2"
              aria-label={translations['plugins.apiKeyModal.copyAriaLabel']}
            >
              {copied ? translations['plugins.apiKeyModal.copied'] : translations['plugins.apiKeyModal.copy']}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-4 border-t border-border">
          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
          >
            {translations['plugins.apiKeyModal.done']}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ApiKeyRevealModal;
