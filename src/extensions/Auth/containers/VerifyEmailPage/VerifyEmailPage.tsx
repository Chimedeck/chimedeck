import { useEffect } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  verifyEmailThunk,
  selectVerifyStatus,
  selectVerifyError,
  selectResendStatus,
  resendVerificationThunk,
} from './VerifyEmailPage.duck';
import translations from '../../translations/en.json';

export default function VerifyEmailPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const status = useAppSelector(selectVerifyStatus);
  const error = useAppSelector(selectVerifyError);
  const resendStatus = useAppSelector(selectResendStatus);

  useEffect(() => {
    if (token) {
      dispatch(verifyEmailThunk({ token }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'success') {
      // Slight delay so user sees the success message before redirect
      const timer = setTimeout(() => navigate('/workspaces', { replace: true }), 1500);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const handleResend = () => {
    dispatch(resendVerificationThunk());
  };

  return (
    <main className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-bg-surface border border-border rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
          <span className="text-xl font-bold text-base">Kanban</span>
        </div>

        <h1 className="text-2xl font-bold text-base mb-4">
          {translations.verifyEmail.title}
        </h1>

        {status === 'loading' && (
          <p className="text-subtle">Verifying your email…</p>
        )}

        {status === 'success' && (
          <p className="text-success font-medium">{translations.verifyEmail.success}</p>
        )}

        {status === 'error' && (
          <div>
            <p className="text-danger mb-4">{translations.verifyEmail.invalidToken}</p>
            {resendStatus === 'sent' ? (
              <p className="text-success text-sm">{translations.verifyEmail.resendSuccess}</p>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleResend}
                disabled={resendStatus === 'loading'}
                className="mt-2"
              >
                {resendStatus === 'loading' ? 'Sending…' : translations.verifyEmail.resend}
              </Button>
            )}
            {resendStatus === 'error' && (
              <p className="text-danger text-sm mt-2">Failed to resend. Please try again later.</p>
            )}
            {!token && (
              <p className="text-muted text-sm mt-4">{error}</p>
            )}
          </div>
        )}

        {status === 'idle' && !token && (
          <p className="text-subtle">{translations.verifyEmail.invalidToken}</p>
        )}
      </div>
    </main>
  );
}
