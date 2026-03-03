import { useEffect } from 'react';
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
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-2xl" aria-hidden="true">🟦</span>
          <span className="text-xl font-bold text-white">Kanban</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">
          {translations.verifyEmail.title}
        </h1>

        {status === 'loading' && (
          <p className="text-slate-400">Verifying your email…</p>
        )}

        {status === 'success' && (
          <p className="text-green-400 font-medium">{translations.verifyEmail.success}</p>
        )}

        {status === 'error' && (
          <div>
            <p className="text-red-400 mb-4">{translations.verifyEmail.invalidToken}</p>
            {resendStatus === 'sent' ? (
              <p className="text-green-400 text-sm">{translations.verifyEmail.resendSuccess}</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendStatus === 'loading'}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {resendStatus === 'loading' ? 'Sending…' : translations.verifyEmail.resend}
              </button>
            )}
            {resendStatus === 'error' && (
              <p className="text-red-400 text-sm mt-2">Failed to resend. Please try again later.</p>
            )}
            {!token && (
              <p className="text-slate-500 text-sm mt-4">{error}</p>
            )}
          </div>
        )}

        {status === 'idle' && !token && (
          <p className="text-slate-400">{translations.verifyEmail.invalidToken}</p>
        )}
      </div>
    </main>
  );
}
