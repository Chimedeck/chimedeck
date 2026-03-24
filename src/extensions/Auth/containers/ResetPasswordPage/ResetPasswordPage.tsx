import { useState, useEffect, type FormEvent } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { resetPasswordThunk, selectResetPasswordStatus, selectResetPasswordError } from './ResetPasswordPage.duck';
import translations from '../../translations/en.json';

export default function ResetPasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const status = useAppSelector(selectResetPasswordStatus);
  const apiError = useAppSelector(selectResetPasswordError);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({ password: '', confirmPassword: '' });

  document.title = `Reset Password — ${translations.appName}`;

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(
        () => navigate('/login', { replace: true, state: { toast: translations.resetPassword.success } }),
        1500,
      );
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const validate = () => {
    const next = { password: '', confirmPassword: '' };
    if (!password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      next.password = translations.resetPassword.tooWeak;
    }
    if (password !== confirmPassword) {
      next.confirmPassword = translations.resetPassword.mismatch;
    }
    setErrors(next);
    return !next.password && !next.confirmPassword;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await dispatch(resetPasswordThunk({ token, password }));
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
            <span className="text-xl font-bold text-white">{translations.appName}</span>
          </div>
          <p className="text-red-400 mb-4">{translations.resetPassword.invalidToken}</p>
          <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 text-sm underline">
            {translations.resetPassword.requestNew}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
          <span className="text-xl font-bold text-white">{translations.appName}</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6">{translations.resetPassword.title}</h1>

        {status === 'success' && (
          <p className="text-green-400 font-medium">{translations.resetPassword.success}</p>
        )}

        {status === 'error' && (
          <div className="mb-4">
            {apiError === 'invalid-or-expired-token' ? (
              <div>
                <p className="text-red-400 mb-2">{translations.resetPassword.invalidToken}</p>
                <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 text-sm underline">
                  {translations.resetPassword.requestNew}
                </Link>
              </div>
            ) : (
              <p className="text-red-400">{translations.resetPassword.invalidToken}</p>
            )}
          </div>
        )}

        {status !== 'success' && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="reset-password" className="text-sm font-medium text-slate-300">
                  {translations.resetPassword.newPassword}
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'reset-password-error' : undefined}
                />
                {errors.password && (
                  <span id="reset-password-error" className="text-red-400 text-xs mt-1" role="alert">
                    {errors.password}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="reset-confirm-password" className="text-sm font-medium text-slate-300">
                  {translations.resetPassword.confirmPassword}
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
                />
                {errors.confirmPassword && (
                  <span id="reset-confirm-error" className="text-red-400 text-xs mt-1" role="alert">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                {status === 'loading' ? 'Resetting…' : translations.resetPassword.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
