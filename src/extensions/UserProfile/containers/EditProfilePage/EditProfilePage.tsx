// EditProfilePage — profile settings page.
// Sprint 28: Navigated to when clicking "Edit profile info" in the member popover.
// Sprint 40: Includes ChangeEmailForm for email address changes with optional re-verification flow.
// Sprint 71: Includes NotificationPreferencesPanel gated by NOTIFICATION_PREFERENCES_ENABLED.
// Sprint 95: Includes GlobalNotificationToggle for master notification opt-out.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import translations from '../../translations/en.json';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import ChangeEmailForm from '~/extensions/Auth/components/ChangeEmailForm';
import { selectNotificationPreferencesEnabled } from '~/slices/featureFlagsSlice';
import NotificationPreferencesPanel from '~/extensions/Notifications/NotificationPreferences/NotificationPreferencesPanel';
import GlobalNotificationToggle from './GlobalNotificationToggle';

const EditProfilePage = () => {
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  const [displayEmail, setDisplayEmail] = useState(user?.email ?? '');
  const notificationPreferencesEnabled = useAppSelector(selectNotificationPreferencesEnabled);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full space-y-8">
        <div className="flex items-center gap-3">
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors text-sm"
            onClick={() => navigate(-1)}
          >
            {translations['UserProfile.backButton']}
          </button>
          <h1 className="text-2xl font-bold">{translations['UserProfile.pageTitle']}</h1>
        </div>

        {/* Current account info */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{translations['UserProfile.signedInAs']}</p>
          <p className="text-sm text-slate-300">{displayEmail}</p>
        </div>

        {/* Divider */}
        <hr className="border-slate-800" />

        {/* Change email section */}
        <section>
          <ChangeEmailForm
            currentEmail={displayEmail}
            onSuccess={(newEmail) => setDisplayEmail(newEmail)}
          />
        </section>

        {/* Divider */}
        <hr className="border-slate-800" />

        {/* Global notifications section */}
        <section>
          <h2 className="text-base font-semibold text-slate-100 mb-4">
            {translations['UserProfile.notifications']}
          </h2>
          <GlobalNotificationToggle />
        </section>

        {notificationPreferencesEnabled && (
          <>
            {/* Divider */}
            <hr className="border-slate-800" />

            {/* Notification preferences section */}
            <section>
              <h2 className="text-base font-semibold text-slate-100 mb-4">
                {translations['UserProfile.notificationPreferences']}
              </h2>
              <NotificationPreferencesPanel />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default EditProfilePage;
