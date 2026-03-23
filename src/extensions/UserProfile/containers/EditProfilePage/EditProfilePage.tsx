// EditProfilePage — profile settings page.
// Sprint 28: Navigated to when clicking "Edit profile info" in the member popover.
// Sprint 40: Includes ChangeEmailForm for email address changes with optional re-verification flow.
// Sprint 71: Includes NotificationPreferencesPanel gated by NOTIFICATION_PREFERENCES_ENABLED.
// Sprint 95: Includes GlobalNotificationToggle for master notification opt-out.
// Sprint 96: Refactored to two-tab layout (Profile / Notifications) driven by ?tab= query param.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import translations from '../../translations/en.json';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectAuthUser } from '~/extensions/Auth/duck/authDuck';
import ChangeEmailForm from '~/extensions/Auth/components/ChangeEmailForm';
import { selectNotificationPreferencesEnabled } from '~/slices/featureFlagsSlice';
import NotificationPreferencesPanel from '~/extensions/Notifications/NotificationPreferences/NotificationPreferencesPanel';
import GlobalNotificationToggle from './GlobalNotificationToggle';

type Tab = 'profile' | 'notifications';
const VALID_TABS: Tab[] = ['profile', 'notifications'];

const EditProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAppSelector(selectAuthUser);
  const [displayEmail, setDisplayEmail] = useState(user?.email ?? '');
  const notificationPreferencesEnabled = useAppSelector(selectNotificationPreferencesEnabled);

  // [why] URL-driven tab state so direct links and back/forward navigation work correctly.
  const rawTab = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'profile';

  const switchTab = (tab: Tab) => {
    if (tab === 'profile') {
      // [why] Remove the param entirely when switching to the default tab to keep URLs clean.
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
      activeTab === tab
        ? 'border-indigo-500 text-indigo-400'
        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
    }`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors text-sm"
            onClick={() => navigate(-1)}
          >
            {translations['UserProfile.backButton']}
          </button>
          <h1 className="text-2xl font-bold">{translations['UserProfile.pageTitle']}</h1>
        </div>

        {/* Tab navigation */}
        <nav className="flex gap-1 border-b border-slate-800 -mx-8 px-8" role="tablist" aria-label="Profile settings tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'profile'}
            aria-controls="tab-panel-profile"
            className={tabClass('profile')}
            onClick={() => switchTab('profile')}
          >
            {translations['UserProfile.tabProfile']}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'notifications'}
            aria-controls="tab-panel-notifications"
            className={tabClass('notifications')}
            onClick={() => switchTab('notifications')}
          >
            {translations['UserProfile.tabNotifications']}
          </button>
        </nav>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <div id="tab-panel-profile" role="tabpanel" className="space-y-6">
            {/* Current account info */}
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{translations['UserProfile.signedInAs']}</p>
              <p className="text-sm text-slate-300">{displayEmail}</p>
            </div>

            <hr className="border-slate-800" />

            <section>
              <ChangeEmailForm
                currentEmail={displayEmail}
                onSuccess={(newEmail) => setDisplayEmail(newEmail)}
              />
            </section>
          </div>
        )}

        {/* Notifications tab */}
        {activeTab === 'notifications' && (
          <div id="tab-panel-notifications" role="tabpanel" className="space-y-6">
            <GlobalNotificationToggle />

            {notificationPreferencesEnabled && (
              <>
                <hr className="border-slate-800" />
                <NotificationPreferencesPanel />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditProfilePage;
