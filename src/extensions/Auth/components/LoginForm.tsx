import { useState, type FormEvent } from 'react';
import PasswordInput from './PasswordInput';
import AuthDivider from './AuthDivider';
import OAuthButton from './OAuthButton';
import VerificationPending from './VerificationPending';
import config from '~/config';
import translations from '../translations/en.json';

// API error codes → user-friendly field messages
// [why] email-not-verified is handled separately via VerificationPending banner
const API_ERROR_MAP: Record<string, string> = {
  'invalid-credentials': translations.errors.invalidCredentials,
  'login-failed': translations.errors.loginFailed,
};

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  apiError: string | null;
}

function validateEmail(value: string) {
  if (!value) return translations.validation.emailRequired;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return translations.validation.emailInvalid;
  return '';
}

function validatePassword(value: string) {
  if (!value) return translations.validation.passwordRequired;
  return '';
}

export default function LoginForm({ onSubmit, isLoading, apiError }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });

  const validate = () => {
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(next);
    return !next.email && !next.password;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(email, password);
  };

  const mappedApiError = apiError ? (API_ERROR_MAP[apiError] ?? translations.errors.loginFailed) : null;

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
      <div className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="login-email" className="text-sm font-medium text-subtle">
            {translations.fields.email}
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
            placeholder="you@example.com"
            className={`w-full bg-bg-overlay border ${errors.email ? 'border-danger' : 'border-border'} text-base placeholder:text-subtle rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary`}
          />
          {errors.email && <p className="text-danger text-sm">{errors.email}</p>}
        </div>

        {/* Password */}
        <PasswordInput
          id="login-password"
          label={translations.fields.password}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password) }))}
          placeholder="••••••••"
          error={errors.password}
        />

        {/* API error shown below form, not on specific field */}
        {apiError === 'email-not-verified' && <VerificationPending email={email} />}
        {apiError !== 'email-not-verified' && mappedApiError && (
          <p role="alert" className="text-danger text-sm">{mappedApiError}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary-hover active:bg-primary text-white font-medium rounded-lg py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" // [theme-exception] text-white on primary button
        >
          {isLoading ? translations.actions.signingIn : translations.actions.signIn}
        </button>

        {(config.oauthGoogleEnabled || config.oauthGithubEnabled) && (
          <>
            <AuthDivider />
            {config.oauthGoogleEnabled && (
              <OAuthButton
                icon={<GoogleIcon />}
                label={translations.oauth.continueWithGoogle}
              />
            )}
            {config.oauthGithubEnabled && (
              <OAuthButton
                icon={<GitHubIcon />}
                label={translations.oauth.continueWithGitHub}
              />
            )}
          </>
        )}
      </div>
    </form>
  );
}

// Inline SVG icons to avoid extra dependencies
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
