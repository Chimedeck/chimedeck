import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { resendVerificationThunk, selectResendStatus } from '../containers/VerifyEmailPage/VerifyEmailPage.duck';
import translations from '../translations/en.json';

interface VerificationPendingProps {
  email: string;
  onDismiss?: () => void;
}

// Banner shown after registration when email verification is required.
export default function VerificationPending({ email, onDismiss }: VerificationPendingProps) {
  const dispatch = useAppDispatch();
  const resendStatus = useAppSelector(selectResendStatus);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleResend = () => {
    dispatch(resendVerificationThunk());
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-950/60 p-4 text-sm text-indigo-200 relative">
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-indigo-400 hover:text-base"
      >
        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      <p className="mb-3">
        {translations.verifyEmail.pending.replace('{email}', email)}
      </p>

      {resendStatus === 'sent' ? (
        <p className="text-success">{translations.verifyEmail.resendSuccess}</p>
      ) : (
        <button
          onClick={handleResend}
          disabled={resendStatus === 'loading'}
          className="px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors" // [theme-exception] text-white on primary button
        >
          {resendStatus === 'loading' ? 'Sending…' : translations.verifyEmail.resend}
        </button>
      )}
    </div>
  );
}
