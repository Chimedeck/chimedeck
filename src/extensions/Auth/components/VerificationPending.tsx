import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';
import IconButton from '~/common/components/IconButton';
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
      <IconButton
        onClick={handleDismiss}
        aria-label="Dismiss"
        icon={<XMarkIcon className="h-4 w-4" aria-hidden="true" />}
        variant="ghost"
        className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-200"
      />

      <p className="mb-3">
        {translations.verifyEmail.pending.replace('{email}', email)}
      </p>

      {resendStatus === 'sent' ? (
        <p className="text-success">{translations.verifyEmail.resendSuccess}</p>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={handleResend}
          disabled={resendStatus === 'loading'}
        >
          {resendStatus === 'loading' ? 'Sending…' : translations.verifyEmail.resend}
        </Button>
      )}
    </div>
  );
}
