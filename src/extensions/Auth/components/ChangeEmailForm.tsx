// ChangeEmailForm — embedded in the profile settings page.
// Submits POST /api/v1/auth/change-email and renders the pending banner on confirmation flow.
import { useState } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { createAppAsyncThunk } from '~/utils/redux';
import { authApi } from '../api/auth';
import EmailChangePending from './EmailChangePending';
import translations from '../translations/en.json';

// ---------- Inline mini-thunk (no dedicated duck needed for this small form) ----------

let _dispatch: ReturnType<typeof useAppDispatch> | null = null;

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
  currentEmail: string;
  onSuccess?: (newEmail: string) => void;
}

export default function ChangeEmailForm({ currentEmail, onSuccess }: ChangeEmailFormProps) {
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
      } else if (result.email) {
        onSuccess?.(result.email);
      }
    } catch (err: unknown) {
      const apiError = isApiError(err) ? err.response.data.name : null;
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
      <h2 className="text-lg font-semibold text-white">{translations.changeEmail.title}</h2>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="newEmail">
          {translations.changeEmail.newEmail}
        </label>
        <input
          id="newEmail"
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder={currentEmail}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="currentPasswordEmail">
          {translations.changeEmail.currentPassword}
        </label>
        <input
          id="currentPasswordEmail"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {submitting ? 'Submitting…' : translations.changeEmail.submit}
      </button>
    </form>
  );
}

// ---------- Helpers ----------

function isApiError(
  err: unknown
): err is { response: { status: number; data: { name: string } } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>)['response'] === 'object'
  );
}
