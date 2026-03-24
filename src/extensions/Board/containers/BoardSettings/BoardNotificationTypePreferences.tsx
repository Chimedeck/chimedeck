// BoardNotificationTypePreferences — per-type toggle matrix for the current user scoped to a board.
// Renders a two-column (In-App, Email) grid for all 9 notification types.
// Toggles with source='board' show an indigo ring to indicate a board-level override is active.
// Email column is hidden when SES_ENABLED or EMAIL_NOTIFICATIONS_ENABLED is false.
import { useCallback, useState } from 'react';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectSesEnabled, selectEmailNotificationsEnabled } from '~/slices/featureFlagsSlice';
import {
  useGetBoardTypePreferencesQuery,
  useUpdateBoardTypePreferenceMutation,
  useResetBoardTypePreferencesMutation,
} from '~/extensions/Notifications/NotificationPreferences/boardNotificationTypePreferences.slice';
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from '~/extensions/Notifications/NotificationPreferences/types';
import type { NotificationType } from '~/extensions/Notifications/NotificationPreferences/types';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
}

// Pill-shaped accessible toggle switch that optionally shows an indigo ring for board overrides.
const ToggleSwitch = ({
  enabled,
  onChange,
  disabled,
  ariaLabel,
  isBoardOverride,
  disabledTooltip,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
  /** When true, renders an indigo ring indicating a board-level override is active. */
  isBoardOverride?: boolean;
  disabledTooltip?: string;
}) => {
  const track = disabled
    ? 'bg-slate-700 cursor-not-allowed opacity-40'
    : enabled
      ? 'bg-indigo-600'
      : 'bg-slate-600 hover:bg-slate-500';

  // [why] Indigo ring visually distinguishes board-level overrides from inherited (user/default) values.
  const ring = isBoardOverride
    ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900 rounded-full'
    : '';

  return (
    <span title={disabled ? disabledTooltip : isBoardOverride ? translations['BoardSettings.notificationTypePreferencesSource.board'] : undefined}>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${track} ${ring}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </span>
  );
};

const BoardNotificationTypePreferences = ({ boardId }: Props) => {
  const sesEnabled = useAppSelector(selectSesEnabled);
  const emailNotificationsEnabled = useAppSelector(selectEmailNotificationsEnabled);
  const emailEnabled = sesEnabled && emailNotificationsEnabled;

  const { data: preferences, isLoading } = useGetBoardTypePreferencesQuery({ boardId });
  const [updatePreference] = useUpdateBoardTypePreferenceMutation();
  const [resetPreferences, { isLoading: isResetting }] = useResetBoardTypePreferencesMutation();

  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const getPreference = (type: NotificationType) =>
    preferences?.find((p) => p.type === type);

  const handleToggle = useCallback(
    async (type: NotificationType, channel: 'in_app_enabled' | 'email_enabled', next: boolean) => {
      setError(null);
      try {
        await updatePreference({ boardId, type, [channel]: next }).unwrap();
      } catch {
        setError('Failed to save preference. Please try again.');
      }
    },
    [boardId, updatePreference],
  );

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setError(null);
    try {
      await resetPreferences({ boardId }).unwrap();
    } catch {
      setError('Failed to reset preferences. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="py-2 text-xs text-slate-500 animate-pulse">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row with title and reset button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">
          {translations['BoardSettings.notificationTypePreferences']}
        </span>
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          {confirmReset
            ? translations['BoardSettings.notificationTypePreferencesResetConfirm']
            : translations['BoardSettings.notificationTypePreferencesReset']}
        </button>
      </div>

      {/* Toggle matrix table */}
      <table className="w-full text-xs text-slate-300">
        <thead>
          <tr className="text-slate-500 uppercase tracking-wide">
            <th className="pb-2 text-left font-medium">Notification</th>
            <th className="pb-2 text-center font-medium w-16">In-App</th>
            {emailEnabled && (
              <th className="pb-2 text-center font-medium w-16">Email</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {NOTIFICATION_TYPES.map((type) => {
            const pref = getPreference(type);
            // Opt-out model: default to enabled when no row exists yet.
            const inAppChecked = pref?.in_app_enabled ?? true;
            const emailChecked = pref?.email_enabled ?? true;
            const isBoardOverride = pref?.source === 'board';

            return (
              <tr key={type}>
                <td className="py-2 text-slate-200">{NOTIFICATION_TYPE_LABELS[type]}</td>
                <td className="py-2 text-center">
                  <ToggleSwitch
                    enabled={inAppChecked}
                    onChange={(next) => handleToggle(type, 'in_app_enabled', next)}
                    ariaLabel={`${NOTIFICATION_TYPE_LABELS[type]} — In-App`}
                    isBoardOverride={isBoardOverride}
                  />
                </td>
                {emailEnabled && (
                  <td className="py-2 text-center">
                    <ToggleSwitch
                      enabled={emailChecked}
                      onChange={(next) => handleToggle(type, 'email_enabled', next)}
                      ariaLabel={`${NOTIFICATION_TYPE_LABELS[type]} — Email`}
                      isBoardOverride={isBoardOverride}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

export default BoardNotificationTypePreferences;
