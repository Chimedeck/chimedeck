// NotificationPreferencesPanel — table of toggles for notification preferences.
// Renders one row per notification type with In-App and Email channel columns.
// Email toggles are disabled when SES_ENABLED or EMAIL_NOTIFICATIONS_ENABLED is off.
// The panel is gated by NOTIFICATION_PREFERENCES_ENABLED — callers must check the flag.
import { useCallback, useState } from 'react';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectSesEnabled, selectEmailNotificationsEnabled } from '~/slices/featureFlagsSlice';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from './notificationPreferences.slice';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from './types';
import type { NotificationType } from './types';
import ToastRegion from '~/common/components/ToastRegion';
import type { ToastItem } from '~/common/components/ToastRegion';
import translations from '../translations/en.json';

// Pill-shaped accessible toggle switch.
const ToggleSwitch = ({
  enabled,
  onChange,
  disabled,
  ariaLabel,
  disabledTooltip,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
  disabledTooltip?: string;
}) => {
  const track = disabled
    ? 'bg-gray-200 dark:bg-slate-700 cursor-not-allowed opacity-40'
    : enabled
      ? 'bg-indigo-600'
      : 'bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500';

  return (
    <span title={disabled ? disabledTooltip : undefined}>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${track}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </span>
  );
};

const NotificationPreferencesPanel = () => {
  const sesEnabled = useAppSelector(selectSesEnabled);
  const emailNotificationsEnabled = useAppSelector(selectEmailNotificationsEnabled);
  const emailEnabled = sesEnabled && emailNotificationsEnabled;

  const { data: preferences, isLoading } = useGetNotificationPreferencesQuery();
  const [updatePreference] = useUpdateNotificationPreferencesMutation();

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addErrorToast = useCallback((message: string) => {
    setToasts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), message, variant: 'error' },
    ]);
  }, []);

  const getPreference = (type: NotificationType) =>
    preferences?.find((p) => p.type === type);

  const handleToggle = async (
    type: NotificationType,
    channel: 'in_app_enabled' | 'email_enabled',
    next: boolean,
  ) => {
    try {
      await updatePreference({ type, [channel]: next }).unwrap();
    } catch {
      addErrorToast(translations['NotificationPreferences.updateError']);
    }
  };

  if (isLoading) {
    return (
      <div className="py-4 text-sm text-gray-400 dark:text-slate-500 animate-pulse">
        {translations['NotificationPreferences.loading']}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-700 dark:text-slate-300">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide">
              <th className="pb-3 text-left font-medium">{translations['NotificationPreferences.columnNotification']}</th>
              <th className="pb-3 text-center font-medium w-24">{translations['NotificationPreferences.columnInApp']}</th>
              <th className="pb-3 text-center font-medium w-24">{translations['NotificationPreferences.columnEmail']}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {NOTIFICATION_TYPES.map((type) => {
              const pref = getPreference(type);
              // Opt-out model: default to enabled when no row exists yet.
              const inAppChecked = pref?.in_app_enabled ?? true;
              const emailChecked = pref?.email_enabled ?? true;

              return (
                <tr key={type} className="py-2">
                  <td className="py-3 text-gray-800 dark:text-slate-200">
                    {NOTIFICATION_TYPE_LABELS[type]}
                  </td>
                  <td className="py-3 text-center">
                    <ToggleSwitch
                      enabled={inAppChecked}
                      onChange={(next) => handleToggle(type, 'in_app_enabled', next)}
                      ariaLabel={`${NOTIFICATION_TYPE_LABELS[type]} — ${translations['NotificationPreferences.columnInApp']}`}
                    />
                  </td>
                  <td className="py-3 text-center">
                    <ToggleSwitch
                      enabled={emailChecked && emailEnabled}
                      onChange={(next) => handleToggle(type, 'email_enabled', next)}
                      disabled={!emailEnabled}
                      ariaLabel={`${NOTIFICATION_TYPE_LABELS[type]} — ${translations['NotificationPreferences.columnEmail']}`}
                      disabledTooltip={translations['NotificationPreferences.emailDisabledTooltip']}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export default NotificationPreferencesPanel;
