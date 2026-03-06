// CardPluginBadges — renders plugin-provided badges on card tiles.
// Resolves the 'card-badges' capability via the plugin bridge and shows
// colour-coded badge chips below the card's existing metadata.
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  cardTitle?: string;
  listTitle?: string;
  boardTitle?: string;
}

// Maps Trello-style color names to Tailwind classes
const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-600/20 text-green-400',
  red: 'bg-red-600/20 text-red-400',
  blue: 'bg-blue-600/20 text-blue-400',
  yellow: 'bg-yellow-600/20 text-yellow-400',
  orange: 'bg-orange-600/20 text-orange-400',
  purple: 'bg-purple-600/20 text-purple-400',
};

const CardPluginBadges = ({ cardId, listId, cardTitle, listTitle, boardTitle }: Props) => {
  const { boardId } = useParams<{ boardId: string }>();
  const bridge = usePluginBridgeContext();
  const [badges, setBadges] = useState<PluginBadge[]>([]);

  useEffect(() => {
    if (!bridge || !boardId) return;
    let cancelled = false;

    bridge
      .resolve('card-badges', {
        card: { id: cardId, ...(cardTitle ? { name: cardTitle } : {}) },
        list: { id: listId, ...(listTitle ? { name: listTitle } : {}) },
        board: { id: boardId, ...(boardTitle ? { name: boardTitle } : {}) },
      })
      .then((results) => {
        if (cancelled) return;
        const all: PluginBadge[] = [];
        for (const result of results) {
          if (Array.isArray(result)) {
            all.push(...(result as PluginBadge[]));
          } else if (result && typeof result === 'object') {
            all.push(result as PluginBadge);
          }
        }
        setBadges(all);
      })
      .catch(() => {
        // Silent fail — plugin errors must not break the card tile
      });

    return () => {
      cancelled = true;
    };
  }, [bridge, boardId, cardId, listId, cardTitle, listTitle, boardTitle]);

  if (badges.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge, i) => {
        const cls =
          (badge.color && COLOR_MAP[badge.color]) ?? 'bg-slate-600/30 text-slate-400';
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}
            title={badge.title}
          >
            {badge.icon && (
              <img src={badge.icon} alt="" className="h-3 w-3 object-contain" />
            )}
            {badge.text}
          </span>
        );
      })}
    </div>
  );
};

export default CardPluginBadges;
