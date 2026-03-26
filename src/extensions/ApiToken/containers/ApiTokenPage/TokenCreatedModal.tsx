// TokenCreatedModal — displays the raw hf_ token exactly once after creation.
// [why] The raw token is never retrievable again; user must copy it here.
import { useState } from 'react';
import Button from '~/common/components/Button';
import translations from '../../translations/en.json';

interface Props {
  rawToken: string;
  onDone: () => void;
}

export default function TokenCreatedModal({ rawToken, onDone }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-bg-surface p-6 shadow-2xl">
        <h2 className="mb-3 text-lg font-semibold text-base">
          {translations['TokenCreatedModal.title']}
        </h2>
        <p className="mb-4 rounded-md bg-amber-900/40 px-3 py-2 text-sm font-semibold text-amber-300">
          {translations['TokenCreatedModal.warning']}
        </p>
        <div className="mb-6 flex items-center gap-2">
          <input
            readOnly
            value={rawToken}
            className="flex-1 rounded-lg bg-bg-base px-3 py-2 font-mono text-sm text-green-400 border border-border focus:outline-none"
            aria-label="API token value"
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleCopy}
            className="min-w-[80px]"
          >
            {copied
              ? translations['TokenCreatedModal.copiedButton']
              : translations['TokenCreatedModal.copyButton']}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="md"
            onClick={onDone}
          >
            {translations['TokenCreatedModal.doneButton']}
          </Button>
        </div>
      </div>
    </div>
  );
}
