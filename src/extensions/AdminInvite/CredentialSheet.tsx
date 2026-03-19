// CredentialSheet — shown inside InviteExternalUserModal after a successful
// account creation. Displays the new user's credentials in a copyable block.
import { useState } from 'react';
import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import translations from './translations/en.json';

interface CredentialSheetProps {
  email: string;
  plainPassword: string;
  loginUrl: string;
  emailSent: boolean;
  /** ISO timestamp if the account was auto-verified, null otherwise. */
  emailVerifiedAt: string | null;
  onDone: () => void;
}

export default function CredentialSheet({
  email,
  plainPassword,
  loginUrl,
  emailSent,
  emailVerifiedAt,
  onDone,
}: CredentialSheetProps) {
  const [copied, setCopied] = useState(false);

  const clipboardText = [
    `${translations['AdminInvite.credentialFieldEmail']}     ${email}`,
    `${translations['AdminInvite.credentialFieldPassword']}  ${plainPassword}`,
    `${translations['AdminInvite.credentialFieldLoginUrl']} ${loginUrl}`,
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
      <h3 className="text-lg font-semibold text-white mb-4">{translations['AdminInvite.credentialSheetTitle']}</h3>

      {emailSent && (
        <p className="mb-4 rounded-md bg-indigo-900/40 px-3 py-2 text-sm text-indigo-300">
          {translations['AdminInvite.credentialSheetEmailSent']}
        </p>
      )}

      {/* Email verification status — only shown when the server returned a value */}
      {emailVerifiedAt !== undefined && (
        <p
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            emailVerifiedAt
              ? 'bg-green-900/30 text-green-300'
              : 'bg-yellow-900/30 text-yellow-300'
          }`}
          data-testid="email-verification-status"
        >
          {emailVerifiedAt ? translations['AdminInvite.credentialEmailVerified'] : translations['AdminInvite.credentialEmailNotVerified']}
        </p>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-200 space-y-1 mb-6">
        <p>
          <span className="text-slate-500">{translations['AdminInvite.credentialFieldEmail']}&nbsp;&nbsp;&nbsp;&nbsp;</span>
          {email}
        </p>
        <p>
          <span className="text-slate-500">{translations['AdminInvite.credentialFieldPassword']}&nbsp;</span>
          {plainPassword}
        </p>
        <p>
          <span className="text-slate-500">{translations['AdminInvite.credentialFieldLoginUrl']}&nbsp;</span>
          {loginUrl}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label={translations['AdminInvite.copyAriaLabel']}
        >
          {copied ? (
            <>
              <CheckIcon className="h-4 w-4 text-green-400" aria-hidden="true" />
              {translations['AdminInvite.copiedStatus']}
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />
              {translations['AdminInvite.copyButton']}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          {translations['AdminInvite.doneButton']}
        </button>
      </div>
    </div>
  );
}
