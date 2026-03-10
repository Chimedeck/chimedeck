// ProfilePage — settings page for avatar, nickname, and email.
import { useCallback, useEffect, useState } from 'react';
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
import ChangeEmailForm from '~/extensions/Auth/components/ChangeEmailForm';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/Toast';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const status = useAppSelector(selectProfileStatus);
  const [displayEmail, setDisplayEmail] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastItem['variant'] = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    dispatch(fetchProfileThunk());
  }, [dispatch]);

  useEffect(() => {
    if (profile?.email) setDisplayEmail(profile.email);
  }, [profile?.email]);

  if (status === 'loading' && !profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <>
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

        {/* Change email section */}
        <hr className="my-8 border-slate-800" />
        <section>
          <ChangeEmailForm
            currentEmail={displayEmail ?? profile.email}
            onSuccess={(newEmail) => {
              setDisplayEmail(newEmail);
              addToast('Email address updated successfully.');
            }}
            onPending={(pendingEmail) => {
              addToast(`Confirmation email sent to ${pendingEmail}. Click the link to complete the change.`);
            }}
          />
        </section>
      </div>

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
