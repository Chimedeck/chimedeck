import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { resendVerificationThunk, selectResendStatus } from '../containers/VerifyEmailPage/VerifyEmailPage.duck';
import translations from '../translations/en.json';

// Standalone button for triggering a verification email resend.
export default function ResendVerificationButton() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectResendStatus);

  const handleClick = () => {
    dispatch(resendVerificationThunk());
  };

  if (status === 'sent') {
    return (
      <p className="text-success text-sm">{translations.verifyEmail.resendSuccess}</p>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50 text-sm underline"
    >
      {status === 'loading' ? 'Sending…' : translations.verifyEmail.resend}
    </button>
  );
}
