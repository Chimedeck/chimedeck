// BoardNotificationToggle — per-board notification opt-out toggle for the current user.
// Uses optimistic UI: flips state immediately, rolls back on API failure.
import { useState, useEffect } from 'react';
import { BellIcon, BellSlashIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { apiClient } from '~/common/api/client';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
  onMasterEnabledChange?: (enabled: boolean) => void;
}

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
      onClick={() => {
        if (disabled) return;
        onChange(!enabled);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${track}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform /* [theme-exception] toggle thumb */ ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
};

const BoardNotificationToggle = ({ boardId, onMasterEnabledChange }: Props) => {
  // Opt-out model: default to enabled until the API responds.
  const [enabled, setEnabled] = useState(true);
  const [onlyRelatedToMe, setOnlyRelatedToMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    (apiClient as { get: <T>(url: string) => Promise<T> })
      .get<{ data: { notifications_enabled: boolean; only_related_to_me: boolean } }>(
        `/boards/${boardId}/notification-preference`,
      )
      .then((res) => {
        setEnabled(res.data.notifications_enabled);
        setOnlyRelatedToMe(res.data.only_related_to_me);
        onMasterEnabledChange?.(res.data.notifications_enabled);
      })
      .catch(() => {
        // [why] Fallback to enabled on error — safer than silently disabling.
        setEnabled(true);
        setOnlyRelatedToMe(false);
        onMasterEnabledChange?.(true);
        setError(translations['BoardSettings.notificationsLoadError']);
      })
      .finally(() => setLoading(false));
  }, [boardId, onMasterEnabledChange]);

  const patchPreference = async (
    body: { notifications_enabled?: boolean; only_related_to_me?: boolean },
    rollback: () => void,
  ) => {
    setError(null);
    try {
      await (apiClient as { patch: <T>(url: string, data: unknown) => Promise<T> }).patch<{
        data: { notifications_enabled: boolean; only_related_to_me: boolean };
      }>(`/boards/${boardId}/notification-preference`, body);
    } catch {
      rollback();
      setError(translations['BoardSettings.notificationsUpdateError']);
    }
  };

  const handleToggleNotifications = (next: boolean) => {
    const prev = enabled;
    setEnabled(next); // optimistic update
    onMasterEnabledChange?.(next);
    void patchPreference(
      { notifications_enabled: next },
      () => {
        setEnabled(prev);
        onMasterEnabledChange?.(prev);
      },
    );
  };

  const handleToggleOnlyRelatedToMe = (next: boolean) => {
    const prev = onlyRelatedToMe;
    setOnlyRelatedToMe(next); // optimistic update
    void patchPreference({ only_related_to_me: next }, () => setOnlyRelatedToMe(prev));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-subtle">
          {enabled ? (
            <BellIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          ) : (
            <BellSlashIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          )}
          <span>{translations['BoardSettings.notificationsLabel']}</span>
        </div>
        <ToggleSwitch
          enabled={enabled}
          onChange={handleToggleNotifications}
          disabled={loading}
          ariaLabel={translations['BoardSettings.notificationsAriaLabel']}
        />
      </div>

      <div className={`flex items-center justify-between ${enabled ? '' : 'opacity-50'}`}>
        <div className="flex items-center gap-2 text-sm text-subtle">
          <UserCircleIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{translations['BoardSettings.onlyRelatedToMeLabel']}</span>
        </div>
        <ToggleSwitch
          enabled={onlyRelatedToMe}
          onChange={handleToggleOnlyRelatedToMe}
          disabled={loading || !enabled}
          ariaLabel={translations['BoardSettings.onlyRelatedToMeAriaLabel']}
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};

export default BoardNotificationToggle;
