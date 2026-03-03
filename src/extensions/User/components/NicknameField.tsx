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
      <label className="text-sm font-medium text-slate-300">
        {translations['ProfilePage.nickname']}
      </label>
      <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-indigo-500">
        <span className="mr-1 text-slate-400">@</span>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="your_nickname"
          maxLength={50}
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          aria-label={translations['ProfilePage.nickname']}
          aria-describedby={error ? 'nickname-error' : undefined}
          aria-invalid={!!error}
        />
      </div>
      <p className="text-xs text-slate-500">{translations['ProfilePage.nicknameHint']}</p>
      {error && (
        <p id="nickname-error" className="text-sm text-red-400" role="alert">
          {error === 'nickname-taken' ? translations['ProfilePage.nicknameTaken'] : error}
        </p>
      )}
    </div>
  );
}
