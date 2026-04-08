// ProfileForm — nickname and display name fields with save button.
import { useState, type FormEvent } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  updateProfileThunk,
  selectProfileStatus,
} from '../containers/ProfilePage/ProfilePage.duck';
import NicknameField from './NicknameField';
import Button from '~/common/components/Button';
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
        <label htmlFor="display-name" className="text-sm font-medium text-subtle">
          {translations['ProfilePage.displayName']}
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          className="rounded-lg border border-border bg-bg-overlay px-3 py-2 text-sm text-base outline-none placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Nickname */}
      <NicknameField value={nickname} onChange={setNickname} error={nicknameError} />

      <div className="flex items-center gap-4">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={saving}
        >
          {saving ? 'Saving…' : translations['ProfilePage.saveChanges']}
        </Button>

        {saved && (
          <span className="text-sm text-success" role="status">
            {translations['ProfilePage.saved']}
          </span>
        )}
      </div>
    </form>
  );
}
