import { useState, type FormEvent } from 'react';
import Button from '~/common/components/Button';
import PasswordInput from './PasswordInput';
import translations from '../translations/en.json';

// API error codes → user-friendly messages
const API_ERROR_MAP: Record<string, string> = {
  'email-already-taken': translations.errors.emailAlreadyTaken,
  'email-already-registered': translations.errors.emailAlreadyTaken,
  'email-domain-not-allowed': translations.errors.emailDomainNotAllowed,
  'signup-failed': translations.errors.signupFailed,
};

interface SignupFormProps {
  onSubmit: (name: string, email: string, password: string) => Promise<void>;
  isLoading: boolean;
  apiError: string | null;
}

function validateName(value: string) {
  if (!value) return translations.validation.nameRequired;
  if (value.length < 2 || value.length > 80) return translations.validation.nameLength;
  return '';
}

function validateEmail(value: string) {
  if (!value) return translations.validation.emailRequired;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return translations.validation.emailInvalid;
  return '';
}

function validatePassword(value: string) {
  if (!value) return translations.validation.passwordRequired;
  if (value.length < 8) return translations.validation.passwordTooShort;
  if (!/\d/.test(value)) return translations.validation.passwordNeedsNumber;
  return '';
}

function validateConfirm(value: string, password: string) {
  if (!value) return translations.validation.confirmRequired;
  if (value !== password) return translations.validation.passwordMismatch;
  return '';
}

export default function SignupForm({ onSubmit, isLoading, apiError }: SignupFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({ name: '', email: '', password: '', confirm: '' });

  const validate = () => {
    const next = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: validateConfirm(confirm, password),
    };
    setErrors(next);
    return !next.name && !next.email && !next.password && !next.confirm;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(name, email, password);
  };

  const mappedApiError = apiError
    ? (API_ERROR_MAP[apiError] ?? translations.errors.signupFailed)
    : null;

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Sign up form">
      <div className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="signup-name" className="text-sm font-medium text-subtle">
            {translations.fields.name}
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setErrors((prev) => ({ ...prev, name: validateName(name) }))}
            placeholder="Jane Smith"
            className={`w-full bg-bg-overlay border ${errors.name ? 'border-danger' : 'border-border'} text-base placeholder:text-subtle rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary`}
          />
          {errors.name && <p className="text-danger text-sm">{errors.name}</p>}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="signup-email" className="text-sm font-medium text-subtle">
            {translations.fields.email}
          </label>
          <input
            id="signup-email"
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
          id="signup-password"
          label={translations.fields.password}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setErrors((prev) => ({ ...prev, password: validatePassword(password) }))}
          placeholder="Min. 8 characters"
          error={errors.password}
        />

        {/* Confirm password */}
        <PasswordInput
          id="signup-confirm"
          label={translations.fields.confirmPassword}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setErrors((prev) => ({ ...prev, confirm: validateConfirm(confirm, password) }))}
          placeholder="Repeat your password"
          error={errors.confirm}
        />

        {/* API error */}
        {mappedApiError && (
          <p role="alert" className="text-danger text-sm">{mappedApiError}</p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? translations.actions.creatingAccount : translations.actions.createAccount}
        </Button>
      </div>
    </form>
  );
}
