// ProfilePage — settings page for avatar and nickname.
import { useEffect } from 'react';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  fetchProfileThunk,
  selectProfile,
  selectProfileStatus,
} from './ProfilePage.duck';
import AvatarUploader from '../../components/AvatarUploader';
import ProfileForm from '../../components/ProfileForm';
import translations from '../../translations/en.json';
import Spinner from '~/common/components/Spinner';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const status = useAppSelector(selectProfileStatus);

  useEffect(() => {
    dispatch(fetchProfileThunk());
  }, [dispatch]);

  if (status === 'loading' && !profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-white">{translations['ProfilePage.title']}</h1>

      {/* Avatar section */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          {translations['ProfilePage.avatar']}
        </h2>
        <AvatarUploader avatarUrl={profile.avatar_url} name={profile.name} />
      </section>

      {/* Profile form */}
      <ProfileForm user={profile} />
    </div>
  );
}
