// PollingIndicator — badge shown in BoardHeader when HTTP polling fallback is active.
// Styled to match ConnectionBadge (same pill pattern, blue palette for distinction).
import translations from './translations/en.json';

interface Props {
  active: boolean;
}

const PollingIndicator = ({ active }: Props) => {
  if (!active) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-400"
      title={translations['Realtime.statusPollingTitle']}
    >
      {/* Refresh / sync icon */}
      <svg
        className="h-3 w-3 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      {translations['Realtime.statusPolling']}
    </span>
  );
};

export default PollingIndicator;
