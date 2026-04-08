// ChangeEmailForm — embedded in the profile settings page.
// Submits POST /api/v1/auth/change-email and renders the pending banner on confirmation flow.
import { useState } from 'react';
import { authApi } from '../api/auth';
import EmailChangePending from './EmailChangePending';
import translations from '../translations/en.json';

async function submitChangeEmail({
  email,
  currentPassword,
}: {
  email: string;
  currentPassword: string;
}): Promise<{ requiresConfirmation?: boolean; pendingEmail?: string; email?: string }> {
  const response = await authApi.changeEmail({ email, currentPassword });
  return (response as unknown as { data: { requiresConfirmation?: boolean; pendingEmail?: string; email?: string } }).data;
}

// ---------- Component ----------

interface ChangeEmailFormProps {
  readonly currentEmail: string;
  readonly onSuccess?: (newEmail: string) => void;
  readonly onPending?: (pendingEmail: string) => void;
}

export default function ChangeEmailForm({ currentEmail, onSuccess, onPending }: ChangeEmailFormProps) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  if (pendingEmail) {
    return <EmailChangePending pendingEmail={pendingEmail} onDismiss={() => setPendingEmail(null)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await submitChangeEmail({ email: newEmail, currentPassword: password });

      if (result.requiresConfirmation && result.pendingEmail) {
        setPendingEmail(result.pendingEmail);
        onPending?.(result.pendingEmail);
        setNewEmail('');
        setPassword('');
      } else if (result.email) {
        onSuccess?.(result.email);
        setNewEmail('');
        setPassword('');
      }
    } catch (err: unknown) {
      const apiError = isApiError(err) ? err.response.data.error?.code ?? 'unknown-error' : null;
      if (apiError === 'email-already-in-use') {
        setError(translations.changeEmail.emailInUse);
      } else if (apiError === 'email-unchanged') {
        setError(translations.changeEmail.unchanged);
      } else if (apiError === 'credentials-invalid') {
        setError('Current password is incorrect.');
      } else if (apiError === 'email-domain-not-allowed') {
        setError(translations.changeEmail.emailDomainNotAllowed);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-base">{translations.changeEmail.title}</h2>

      <div>
        <label className="block text-sm font-medium text-subtle mb-1" htmlFor="newEmail">
          {translations.changeEmail.newEmail}
        </label>
        <input
          id="newEmail"
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder={currentEmail}
          className="w-full rounded-lg bg-bg-overlay border border-border text-base px-3 py-2 text-sm placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-subtle mb-1" htmlFor="currentPasswordEmail">
          {translations.changeEmail.currentPassword}
        </label>
        <input
          id="currentPasswordEmail"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-bg-overlay border border-border text-base px-3 py-2 text-sm placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors" // [theme-exception] text-white on primary button
      >
        {submitting && (
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> {/* [theme-exception] text-white on primary button spinner */}
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {submitting ? 'Saving…' : translations.changeEmail.submit}
      </button>
    </form>
  );
}

// ---------- Helpers ----------

function isApiError(
  err: unknown
): err is { response: { status: number; data: { error?: { code: string; message: string } } } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>)['response'] === 'object'
  );
}
