// ProfileForm — nickname and display name fields with save button.
import { useState, type FormEvent } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  updateProfileThunk,
  selectProfileStatus,
} from '../containers/ProfilePage/ProfilePage.duck';
import NicknameField from './NicknameField';
import translations from '../translations/en.json';
import type { UserProfile } from '../api/user';

interface ProfileFormProps {
  user: UserProfile;
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectProfileStatus);

  const [name, setName] = useState(user.name);
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saving = status === 'saving';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNicknameError(null);
    setSaved(false);

    const updates: { name?: string; nickname?: string } = {};
    if (name !== user.name) updates.name = name;
    if (nickname !== (user.nickname ?? '') && nickname !== '') updates.nickname = nickname;

    if (Object.keys(updates).length === 0) {
      setSaved(true);
      return;
    }

    const result = await dispatch(updateProfileThunk(updates));

    if (updateProfileThunk.rejected.match(result)) {
      const errName = result.payload as string;
      if (errName === 'nickname-taken') {
        setNicknameError('nickname-taken');
      }
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Display name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="display-name" className="text-sm font-medium text-slate-300">
          {translations['ProfilePage.displayName']}
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
        />
      </div>

      {/* Nickname */}
      <NicknameField value={nickname} onChange={setNickname} error={nicknameError} />

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : translations['ProfilePage.saveChanges']}
        </button>

        {saved && (
          <span className="text-sm text-green-400" role="status">
            {translations['ProfilePage.saved']}
          </span>
        )}
      </div>
    </form>
  );
}
