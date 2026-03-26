import { useState, type FormEvent } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import { forgotPasswordThunk, selectForgotPasswordStatus } from './ForgotPasswordPage.duck';
import translations from '../../translations/en.json';

export default function ForgotPasswordPage() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectForgotPasswordStatus);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  document.title = `Forgot Password — ${translations.appName}`;

  const validate = () => {
    if (!email) {
      setEmailError(translations.validation.emailRequired);
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(translations.validation.emailInvalid);
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await dispatch(forgotPasswordThunk({ email }));
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Squares2X2Icon className="h-7 w-7 text-indigo-400" aria-hidden="true" />
          <span className="text-xl font-bold text-white">{translations.appName}</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">{translations.forgotPassword.title}</h1>
        <p className="text-slate-400 text-sm mb-6">{translations.forgotPassword.description}</p>

        {status === 'success' ? (
          <div>
            <p className="text-green-400 mb-6">
              {translations.forgotPassword.sent.replace('{email}', email)}
            </p>
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              {translations.forgotPassword.backToLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="forgot-email" className="text-sm font-medium text-slate-300">
                  {translations.forgotPassword.email}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-bg-overlay border border-border rounded-lg px-3 py-2 text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="you@example.com"
                  aria-describedby={emailError ? 'forgot-email-error' : undefined}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <span id="forgot-email-error" className="text-red-400 text-xs mt-1" role="alert">
                    {emailError}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                {status === 'loading' ? 'Sending…' : translations.forgotPassword.submit}
              </button>
            </div>

            <p className="text-slate-500 text-sm text-center mt-6">
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                {translations.forgotPassword.backToLogin}
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
