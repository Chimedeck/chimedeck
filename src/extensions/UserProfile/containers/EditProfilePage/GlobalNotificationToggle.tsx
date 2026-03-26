// GlobalNotificationToggle — master notification opt-out toggle for the current user.
// When off, all board notifications are silenced regardless of per-board settings.
// Uses optimistic UI: flips state immediately, rolls back on API failure.
import { useState, useEffect } from 'react';
import { BellIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import translations from '../../translations/en.json';

// Pill-shaped accessible toggle switch (inline — keeps this file self-contained).
const ToggleSwitch = ({
  enabled,
  onChange,
  disabled,
  ariaLabel,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) => {
  const track = disabled
    ? 'bg-bg-overlay cursor-not-allowed opacity-40'
    : enabled
      ? 'bg-indigo-600'
      : 'bg-bg-sunken hover:bg-bg-overlay';

  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${track}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform /* [theme-exception] toggle thumb */ ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
};

const GlobalNotificationToggle = () => {
  // Opt-out model: default to enabled until the API responds.
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    (apiClient as { get: <T>(url: string) => Promise<T> })
      .get<{ data: { global_notifications_enabled: boolean } }>('/user/notification-settings')
      .then((res) => {
        setEnabled(res.data.global_notifications_enabled);
      })
      .catch(() => {
        // [why] Fallback to enabled on error — safer than silently disabling.
        setEnabled(true);
        setError(translations['UserProfile.notificationsLoadError']);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (next: boolean) => {
    const prev = enabled;
    setEnabled(next); // optimistic update
    setError(null);
    try {
      await (apiClient as { patch: <T>(url: string, data: unknown) => Promise<T> }).patch<{
        data: { global_notifications_enabled: boolean };
      }>('/user/notification-settings', { global_notifications_enabled: next });
    } catch {
      setEnabled(prev); // rollback
      setError(translations['UserProfile.notificationsUpdateError']);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-base">
        {translations['GlobalNotificationToggle.heading']}
      </h2>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-base">
          {enabled ? (
            <BellIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          ) : (
            <BellSlashIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          )}
          <span>{translations['UserProfile.notificationsLabel']}</span>
        </div>
        <ToggleSwitch
          enabled={enabled}
          onChange={handleToggle}
          disabled={loading}
          ariaLabel={translations['UserProfile.notificationsAriaLabel']}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};

export default GlobalNotificationToggle;
