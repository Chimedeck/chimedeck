// CredentialSheet — shown inside InviteExternalUserModal after a successful
// account creation. Displays the new user's credentials in a copyable block.
import { useState } from 'react';
import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface CredentialSheetProps {
  email: string;
  plainPassword: string;
  loginUrl: string;
  emailSent: boolean;
  onDone: () => void;
}

export default function CredentialSheet({
  email,
  plainPassword,
  loginUrl,
  emailSent,
  onDone,
}: CredentialSheetProps) {
  const [copied, setCopied] = useState(false);

  const clipboardText = [
    `Email:     ${email}`,
    `Password:  ${plainPassword}`,
    `Login URL: ${loginUrl}`,
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clipboardText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback — clipboard unavailable in some test environments
    }
  };

  return (
    <div aria-live="polite">
      <h3 className="text-lg font-semibold text-white mb-4">New account created</h3>

      {emailSent && (
        <p className="mb-4 rounded-md bg-indigo-900/40 px-3 py-2 text-sm text-indigo-300">
          Credentials have also been sent to the user&apos;s email address.
        </p>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-200 space-y-1 mb-6">
        <p>
          <span className="text-slate-500">Email:&nbsp;&nbsp;&nbsp;&nbsp;</span>
          {email}
        </p>
        <p>
          <span className="text-slate-500">Password:&nbsp;</span>
          {plainPassword}
        </p>
        <p>
          <span className="text-slate-500">Login URL:&nbsp;</span>
          {loginUrl}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Copy credentials to clipboard"
        >
          {copied ? (
            <>
              <CheckIcon className="h-4 w-4 text-green-400" aria-hidden="true" />
              Copied!
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
              Copy to clipboard
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
