// InviteExternalUserModal — admin-only modal for provisioning an external user account.
// Opens when the admin clicks "Invite External User" in the sidebar.
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import translations from './translations/en.json';
import {
  closeInviteModal,
  selectInviteModalOpen,
  selectInviteCredentials,
  selectInviteEmailSent,
  selectInviteEmailVerifiedAt,
  setInviteCredentials,
} from './adminInvite.slice';
import { selectShowEmailToggle, selectEmailVerificationEnabled } from '~/slices/featureFlagsSlice';
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

const STRENGTH_LABELS = [
  translations['AdminInvite.strengthVeryWeak'],
  translations['AdminInvite.strengthWeak'],
  translations['AdminInvite.strengthFair'],
  translations['AdminInvite.strengthStrong'],
] as const;
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
  const emailVerifiedAt = useAppSelector(selectInviteEmailVerifiedAt);
  const showEmailToggle = useAppSelector(selectShowEmailToggle);
  const emailVerificationEnabled = useAppSelector(selectEmailVerificationEnabled);

  // Form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [passwordMode, setPasswordMode] = useState<PasswordMode>('auto');
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [autoVerifyEmail, setAutoVerifyEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setPasswordMode('auto');
    setPassword('');
    setSendEmail(false);
    setAutoVerifyEmail(true);
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
      errors.email = translations['AdminInvite.errorInvalidEmail'];
    }
    if (!displayName.trim()) {
      errors.displayName = translations['AdminInvite.errorDisplayNameRequired'];
    }
    if (passwordMode === 'manual' && !isStrongPassword(password)) {
      errors.password = translations['AdminInvite.errorPasswordTooWeak'];
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
        // Only send autoVerifyEmail when email verification is enabled; otherwise it's irrelevant.
        ...(emailVerificationEnabled ? { autoVerifyEmail } : {}),
      };
      const response = await adminInviteApi.createUser(body);
      dispatch(
        setInviteCredentials({
          credentials: response.credentials,
          emailSent: response.emailSent,
          emailVerifiedAt: response.data.email_verified_at,
        }),
      );
      resetForm();
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name ?? '';
      const data = (err as { response?: { data?: { name?: string } } })?.response?.data;
      const errorName = data?.name ?? name;

      if (errorName === 'invalid-email') {
        setFieldErrors({ email: translations['AdminInvite.errorInvalidEmailServer'] });
      } else if (errorName === 'display-name-required') {
        setFieldErrors({ displayName: translations['AdminInvite.errorDisplayNameRequiredServer'] });
      } else if (errorName === 'password-too-weak') {
        setFieldErrors({ password: translations['AdminInvite.errorPasswordTooWeakServer'] });
      } else if (errorName === 'email-already-in-use') {
        setServerError(translations['AdminInvite.errorEmailInUse']);
      } else {
        setServerError(translations['AdminInvite.errorGeneric']);
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
              aria-label={translations['AdminInvite.closeButton']}
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
              emailVerifiedAt={emailVerifiedAt}
              onDone={() => handleOpenChange(false)}
            />
          ) : (
            // ── Invite form ─────────────────────────────────────────────────
            <>
              <Dialog.Title className="mb-1 text-lg font-bold text-white">
                {translations['AdminInvite.modalTitle']}
              </Dialog.Title>
              <p
                id="invite-modal-description"
                className="mb-5 text-sm text-slate-400"
              >
                {translations['AdminInvite.modalDescription']}
              </p>

              <form onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div className="mb-4">
                  <label
                    htmlFor="invite-email"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    {translations['AdminInvite.emailLabel']}
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={translations['AdminInvite.emailPlaceholder']}
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
                    {translations['AdminInvite.displayNameLabel']}
                  </label>
                  <input
                    id="invite-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={translations['AdminInvite.displayNamePlaceholder']}
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
                    {translations['AdminInvite.passwordModeLabel']}
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
                      {translations['AdminInvite.passwordModeAuto']}
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
                      {translations['AdminInvite.passwordModeManual']}
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
                      {translations['AdminInvite.passwordLabel']}
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
                  <div className="mb-4">
                    <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 accent-indigo-500"
                      />
                      {translations['AdminInvite.sendEmailToggle']}
                    </label>
                  </div>
                )}

                {/* Auto-verify email — hidden when email verification is disabled globally */}
                {emailVerificationEnabled && (
                  <div className="mb-5">
                    <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoVerifyEmail}
                        onChange={(e) => setAutoVerifyEmail(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 accent-indigo-500"
                        data-testid="auto-verify-email-checkbox"
                      />
                      {translations['AdminInvite.autoVerifyToggle']}
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
                      {translations['AdminInvite.cancelButton']}
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
                    {loading ? translations['AdminInvite.creatingButton'] : translations['AdminInvite.submitButton']}
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
