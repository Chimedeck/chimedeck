// CardPluginBadges — renders plugin-provided badges on card tiles.
// Resolves the 'card-badges' capability via the plugin bridge and shows
// colour-coded badge chips below the card's existing metadata.
import { memo, useEffect, useState } from 'react';
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

interface BadgeResolvePayload extends Record<string, unknown> {
  card: { id: string; name?: string };
  list: { id: string; name?: string };
  board: { id: string; name?: string };
}

const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-100 dark:bg-green-600/20 text-green-700 dark:text-green-400',
  red: 'bg-red-100 dark:bg-red-600/20 text-danger',
  blue: 'bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400',
  yellow: 'bg-amber-100 dark:bg-yellow-600/20 text-amber-700 dark:text-yellow-400',
  orange: 'bg-orange-100 dark:bg-orange-600/20 text-orange-700 dark:text-orange-400',
  purple: 'bg-purple-100 dark:bg-purple-600/20 text-purple-700 dark:text-purple-400',
};

const badgeResultCache = new Map<string, PluginBadge[]>();
const badgeInFlightCache = new Map<string, Promise<PluginBadge[]>>();

function makeBadgeCacheKey(args: {
  boardId: string;
  cardId: string;
  listId: string;
  cardTitle?: string;
  listTitle?: string;
  boardTitle?: string;
}): string {
  return [
    args.boardId,
    args.cardId,
    args.listId,
    args.cardTitle ?? '',
    args.listTitle ?? '',
    args.boardTitle ?? '',
  ].join('||');
}

function normalizeBadgeResults(results: unknown[]): PluginBadge[] {
  const all: PluginBadge[] = [];
  for (const result of results) {
    if (Array.isArray(result)) {
      all.push(...(result as PluginBadge[]));
    } else if (result && typeof result === 'object') {
      all.push(result as PluginBadge);
    }
  }
  return all;
}

function cacheBadgeResult(key: string, badges: PluginBadge[]): void {
  badgeResultCache.set(key, badges);
  if (badgeResultCache.size > 3000) {
    const firstKey = badgeResultCache.keys().next().value;
    if (typeof firstKey === 'string') badgeResultCache.delete(firstKey);
  }
}

function hasSameBadges(prev: PluginBadge[], next: PluginBadge[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const prevBadge = prev[i];
    const nextBadge = next[i];
    if (!prevBadge || !nextBadge) return false;
    if (
      prevBadge.text !== nextBadge.text
      || prevBadge.color !== nextBadge.color
      || prevBadge.icon !== nextBadge.icon
      || prevBadge.title !== nextBadge.title
    ) {
      return false;
    }
  }
  return true;
}

function CardPluginBadgesComponent({
  cardId,
  listId,
  cardTitle,
  listTitle,
  boardTitle,
}: Readonly<Props>) {
  const { boardId } = useParams<{ boardId: string }>();
  const bridge = usePluginBridgeContext();
  const [badges, setBadges] = useState<PluginBadge[]>([]);

  useEffect(() => {
    if (!bridge || !boardId) return;
    let cancelled = false;

    const cacheKey = makeBadgeCacheKey({
      boardId,
      cardId,
      listId,
      ...(cardTitle ? { cardTitle } : {}),
      ...(listTitle ? { listTitle } : {}),
      ...(boardTitle ? { boardTitle } : {}),
    });

    const cachedBadges = badgeResultCache.get(cacheKey);
    if (cachedBadges) {
      setBadges((prev) => (hasSameBadges(prev, cachedBadges) ? prev : cachedBadges));
      return;
    }

    const payload: BadgeResolvePayload = {
      card: { id: cardId, ...(cardTitle ? { name: cardTitle } : {}) },
      list: { id: listId, ...(listTitle ? { name: listTitle } : {}) },
      board: { id: boardId, ...(boardTitle ? { name: boardTitle } : {}) },
    };

    const inFlight = badgeInFlightCache.get(cacheKey);
    const request = inFlight
      ?? bridge
        .resolve('card-badges', payload)
        .then((results) => normalizeBadgeResults(results))
        .catch(() => [])
        .finally(() => {
          badgeInFlightCache.delete(cacheKey);
        });

    if (!inFlight) {
      badgeInFlightCache.set(cacheKey, request);
    }

    request
      .then((all) => {
        if (cancelled) return;
        cacheBadgeResult(cacheKey, all);
        setBadges((prev) => (hasSameBadges(prev, all) ? prev : all));
      })
      .catch(() => {
        // Silent fail — plugin errors must not break the card tile
      });

    return () => {
      cancelled = true;
    };
  }, [bridge, boardId, cardId, listId]);

  if (badges.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge) => {
        const cls =
          (badge.color && COLOR_MAP[badge.color]) ?? 'bg-bg-overlay/30 text-subtle';
        const badgeKey = `${badge.title ?? ''}-${badge.text ?? ''}-${badge.icon ?? ''}-${badge.color ?? ''}`;
        return (
          <span
            key={badgeKey}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}
            title={badge.title}
          >
            {badge.icon && (
              <img
                src={badge.icon}
                alt=""
                className="mr-0.5 h-3 w-3 shrink-0 object-contain"
              />
            )}
            {badge.text}
          </span>
        );
      })}
    </div>
  );
}

const CardPluginBadges = memo(
  CardPluginBadgesComponent,
  (prev, next) => prev.cardId === next.cardId
    && prev.listId === next.listId,
);

export default CardPluginBadges;
