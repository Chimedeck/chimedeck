// InviteExternalUserModal — admin-only modal for provisioning an external user account.
// Opens when the admin clicks "Invite External User" in the sidebar.
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  closeInviteModal,
  selectInviteModalOpen,
  selectInviteCredentials,
  selectInviteEmailSent,
  setInviteCredentials,
} from './adminInvite.slice';
import { selectShowEmailToggle } from '~/slices/featureFlagsSlice';
import { adminInviteApi } from './api';
import CredentialSheet from './CredentialSheet';
import type { PasswordMode } from './types';

// Password is considered strong enough if ≥ 8 chars with at least one letter and one digit.
const isStrongPassword = (pwd: string): boolean =>
  pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);

// 4-level strength score (0–3)
function strengthScore(pwd: string): number {
  if (pwd.length === 0) return 0;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[a-zA-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  return score;
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong'] as const;
const STRENGTH_COLORS = [
  'bg-red-500',
  'bg-orange-400',
  'bg-yellow-400',
  'bg-green-500',
] as const;

interface FieldErrors {
  email?: string;
  displayName?: string;
  password?: string;
}

export default function InviteExternalUserModal() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectInviteModalOpen);
  const credentials = useAppSelector(selectInviteCredentials);
  const emailSentFromStore = useAppSelector(selectInviteEmailSent);
  const showEmailToggle = useAppSelector(selectShowEmailToggle);

  // Form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('auto');
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setPasswordMode('auto');
    setPassword('');
    setSendEmail(false);
    setFieldErrors({});
    setServerError(null);
    setLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      dispatch(closeInviteModal());
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const errors: FieldErrors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!displayName.trim()) {
      errors.displayName = 'Display name is required.';
    }
    if (passwordMode === 'manual' && !isStrongPassword(password)) {
      errors.password = 'Password must be at least 8 characters with a letter and a number.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const body: Parameters<typeof adminInviteApi.createUser>[0] = {
        email: email.toLowerCase().trim(),
        displayName: displayName.trim(),
        ...(passwordMode === 'manual' ? { password } : {}),
        sendEmail: showEmailToggle ? sendEmail : false,
      };
      const response = await adminInviteApi.createUser(body);
      dispatch(
        setInviteCredentials({ credentials: response.credentials, emailSent: response.emailSent }),
      );
      resetForm();
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? '';
      const data = (err as { response?: { data?: { name?: string } } })?.response?.data;
      const errorName = data?.name ?? name;

      if (errorName === 'invalid-email') {
        setFieldErrors({ email: 'Invalid email address.' });
      } else if (errorName === 'display-name-required') {
        setFieldErrors({ displayName: 'Display name is required.' });
      } else if (errorName === 'password-too-weak') {
        setFieldErrors({ password: 'Password is too weak.' });
      } else if (errorName === 'email-already-in-use') {
        setServerError('An account with this email address already exists.');
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const score = strengthScore(password);

  const loginUrl = `${window.location.origin}/login`;

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl focus:outline-none"
          aria-describedby="invite-modal-description"
        >
          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </Dialog.Close>

          {credentials ? (
            // ── Success: show credential sheet ──────────────────────────────
            <CredentialSheet
              email={credentials.email}
              plainPassword={credentials.plainPassword}
              loginUrl={loginUrl}
              emailSent={emailSentFromStore}
              onDone={() => handleOpenChange(false)}
            />
          ) : (
            // ── Invite form ─────────────────────────────────────────────────
            <>
              <Dialog.Title className="mb-1 text-lg font-bold text-white">
                Invite External User
              </Dialog.Title>
              <p
                id="invite-modal-description"
                className="mb-5 text-sm text-slate-400"
              >
                Create an account for someone outside your organisation.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div className="mb-4">
                  <label
                    htmlFor="invite-email"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Email address
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contractor@example.com"
                    required
                    autoFocus
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    aria-describedby={fieldErrors.email ? 'invite-email-error' : undefined}
                  />
                  {fieldErrors.email && (
                    <p id="invite-email-error" className="mt-1 text-xs text-red-400">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Display name */}
                <div className="mb-4">
                  <label
                    htmlFor="invite-display-name"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Display name
                  </label>
                  <input
                    id="invite-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    aria-describedby={
                      fieldErrors.displayName ? 'invite-display-name-error' : undefined
                    }
                  />
                  {fieldErrors.displayName && (
                    <p id="invite-display-name-error" className="mt-1 text-xs text-red-400">
                      {fieldErrors.displayName}
                    </p>
                  )}
                </div>

                {/* Password mode */}
                <fieldset className="mb-4">
                  <legend className="mb-1.5 text-sm font-medium text-slate-300">
                    Password
                  </legend>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="password-mode"
                        value="auto"
                        checked={passwordMode === 'auto'}
                        onChange={() => setPasswordMode('auto')}
                        className="accent-indigo-500"
                      />
                      Generate automatically
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="password-mode"
                        value="manual"
                        checked={passwordMode === 'manual'}
                        onChange={() => setPasswordMode('manual')}
                        className="accent-indigo-500"
                      />
                      Set manually
                    </label>
                  </div>
                </fieldset>

                {/* Manual password input + strength bar */}
                {passwordMode === 'manual' && (
                  <div className="mb-4">
                    <label
                      htmlFor="invite-password"
                      className="mb-1.5 block text-sm font-medium text-slate-300"
                    >
                      Password
                    </label>
                    <input
                      id="invite-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      aria-describedby="invite-password-strength"
                    />
                    {/* Strength bar */}
                    {password.length > 0 && (
                      <div id="invite-password-strength" className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                i < score ? STRENGTH_COLORS[score - 1] : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">
                          {STRENGTH_LABELS[score > 0 ? score - 1 : 0]}
                        </p>
                      </div>
                    )}
                    {fieldErrors.password && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
                    )}
                  </div>
                )}

                {/* Send email toggle — only when both SES and invite email are enabled */}
                {showEmailToggle && (
                  <div className="mb-5">
                    <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 accent-indigo-500"
                      />
                      Send login credentials to the user by email
                    </label>
                  </div>
                )}

                {/* Server error */}
                {serverError && (
                  <p className="mb-3 rounded-md bg-red-900/30 px-3 py-2 text-sm text-red-400">
                    {serverError}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      (passwordMode === 'manual' && !isStrongPassword(password))
                    }
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Creating…' : 'Create account'}
                  </button>
                </div>
              </form>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
