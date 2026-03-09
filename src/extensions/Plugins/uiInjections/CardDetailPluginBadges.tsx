// CardDetailPluginBadges — renders plugin-provided badges in the card detail
// modal. Uses the 'card-detail-badges' capability which may return richer
// content than the compact card-tile badges.
import { useState, useEffect } from 'react';
import { usePluginBridgeContext } from '../iframeHost/usePluginBridge';

interface PluginBadge {
  text?: string;
  color?: string;
  icon?: string;
  title?: string;
}

interface Props {
  cardId: string;
  listId: string;
  boardId: string;
  cardTitle?: string;
  listTitle?: string;
  boardTitle?: string;
}

// Maps Trello-style color names to Tailwind classes (includes border for detail context)
const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-600/20 text-green-400 border-green-700/40',
  red: 'bg-red-600/20 text-red-400 border-red-700/40',
  blue: 'bg-blue-600/20 text-blue-400 border-blue-700/40',
  yellow: 'bg-yellow-600/20 text-yellow-400 border-yellow-700/40',
  orange: 'bg-orange-600/20 text-orange-400 border-orange-700/40',
  purple: 'bg-purple-600/20 text-purple-400 border-purple-700/40',
};

const CardDetailPluginBadges = ({ cardId, listId, boardId, cardTitle, listTitle, boardTitle }: Props) => {
  const bridge = usePluginBridgeContext();
  const [badges, setBadges] = useState<PluginBadge[]>([]);

  useEffect(() => {
    if (!bridge || !boardId) return;
    let cancelled = false;

    bridge
      .resolve('card-detail-badges', {
        card: { id: cardId, ...(cardTitle ? { name: cardTitle } : {}) },
        list: { id: listId, ...(listTitle ? { name: listTitle } : {}) },
        board: { id: boardId, ...(boardTitle ? { name: boardTitle } : {}) },
      })
      .then((results) => {
        if (cancelled) return;
        const all: PluginBadge[] = [];
        for (const result of results) {
          if (Array.isArray(result)) all.push(...(result as PluginBadge[]));
          else if (result && typeof result === 'object')
            all.push(result as PluginBadge);
        }
        setBadges(all);
      })
      .catch(() => {
        // Silent fail — plugin errors must not break the card detail modal
      });

    return () => {
      cancelled = true;
    };
  }, [bridge, boardId, cardId, listId, cardTitle, listTitle, boardTitle]);

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => {
        const cls =
          (badge.color && COLOR_MAP[badge.color]) ??
          'bg-slate-700/50 text-slate-300 border-slate-600/40';
        const badgeKey = `${badge.title ?? ''}-${badge.text ?? ''}-${badge.icon ?? ''}-${badge.color ?? ''}`;
        return (
          <span
            key={badgeKey}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${cls}`}
            title={badge.title}
          >
            {badge.icon && (
              <img
                src={badge.icon}
                alt=""
                className="mr-0.5 h-3.5 w-3.5 shrink-0 object-contain"
              />
            )}
            {badge.text}
          </span>
        );
      })}
    </div>
  );
};

export default CardDetailPluginBadges;
