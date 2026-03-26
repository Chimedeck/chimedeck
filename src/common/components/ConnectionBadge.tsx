// ConnectionBadge — 3-state pill indicator for WebSocket connection.
// Placed in BoardHeader right side per sprint-20 spec §2.
import translations from '~/extensions/Realtime/translations/en.json';

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

interface Props {
  state: ConnectionState;
}

const ConnectionBadge = ({ state }: Props) => {
  if (state === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        {translations['Realtime.statusLive']}
      </span>
    );
  }

  if (state === 'reconnecting') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/20 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {translations['Realtime.statusReconnecting']}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-danger">
      {translations['Realtime.statusOffline']}
    </span>
  );
};

export default ConnectionBadge;
