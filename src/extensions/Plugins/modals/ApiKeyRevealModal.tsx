// One-time display of the newly generated API key after plugin registration.
// The key is never shown again once this modal is dismissed.
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
      aria-label="API Key"
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-slate-900 rounded-lg shadow-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold text-base">Plugin API Key</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 text-yellow-300 text-sm flex gap-2">
            <span>⚠️</span>
            <span>This API key will <strong>never be shown again</strong>. Copy it now and store it securely.</span>
          </div>

          <div className="flex gap-2 items-stretch">
            <code className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-green-300 font-mono break-all">
              {apiKey}
            </code>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded px-3 py-2"
              aria-label="Copy API key"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2"
          >
            I've saved the key — Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ApiKeyRevealModal;
