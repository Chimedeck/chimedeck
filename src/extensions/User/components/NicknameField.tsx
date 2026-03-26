// NicknameField — inline-editable nickname input with @ prefix and client-side validation.
import { type ChangeEvent } from 'react';
import translations from '../translations/en.json';

const NICKNAME_PATTERN = /^[a-zA-Z0-9_-]*$/;

interface NicknameFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

export default function NicknameField({ value, onChange, error }: NicknameFieldProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Strip leading @ if user types it
    const stripped = raw.startsWith('@') ? raw.slice(1) : raw;
    if (NICKNAME_PATTERN.test(stripped) && stripped.length <= 50) {
      onChange(stripped);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-subtle">
        {translations['ProfilePage.nickname']}
      </label>
      <div className="flex items-center rounded-lg border border-border bg-bg-overlay px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
        <span className="mr-1 text-muted">@</span>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="your_nickname"
          maxLength={50}
          className="flex-1 bg-transparent text-sm text-base outline-none placeholder:text-muted"
          aria-label={translations['ProfilePage.nickname']}
          aria-describedby={error ? 'nickname-error' : undefined}
          aria-invalid={!!error}
        />
      </div>
      <p className="text-xs text-muted">{translations['ProfilePage.nicknameHint']}</p>
      {error && (
        <p id="nickname-error" className="text-sm text-red-400" role="alert">
          {error === 'nickname-taken' ? translations['ProfilePage.nicknameTaken'] : error}
        </p>
      )}
    </div>
  );
}
