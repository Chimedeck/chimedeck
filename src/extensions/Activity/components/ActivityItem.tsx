// Human-readable description for a single activity event.
import { Link } from 'react-router-dom';
import translations from '../translations/en.json';

export interface Activity {
  id: string;
  entity_type: string;
  entity_id: string;
  board_id: string | null;
  action: string;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface Props {
  activity: Activity;
  actorName?: string; // display name for actor_id if available
  /** Board id — when supplied, card title in archive events becomes a clickable link. */
  boardId?: string;
}

// Replaces {placeholders} in a translation template with values from a record.
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/** Actions whose entity_id is a card that can be opened via ?card= */
const CARD_LINK_ACTIONS = new Set(['card_archived', 'card_unarchived']);

function describeAction(
  action: string,
  payload: Record<string, unknown>,
  actorName: string
): string {
  const title = String(payload.title ?? payload.cardTitle ?? '');
  const cardTitle = String(payload.cardTitle ?? '');
  const fromList = String(
    payload.fromListName ?? payload.fromList ?? translations['activity.fromList.unknown']
  );
  const toList = String(
    payload.toListName ?? payload.toList ?? translations['activity.toList.unknown']
  );
  const checklistTitle = String(payload.checklistTitle ?? '');
  const itemTitle = String(payload.itemTitle ?? '');
  const commentPreview = String(payload.commentPreview ?? '');
  const name = String(payload.name ?? '');
  const assigneeName = String(payload.assigneeName ?? '');

  const key = `activity.action.${action}` as keyof typeof translations;
  const template = translations[key] ?? translations['activity.action.unknown'];

  return interpolate(template, {
    actor: actorName,
    title,
    cardTitle,
    fromList,
    toList,
    action,
    checklistTitle,
    itemTitle,
    commentPreview,
    name,
    assigneeName,
  });
}

const ActivityItem = ({ activity, actorName, boardId }: Props) => {
  const displayName = actorName ?? activity.actor_id;
  const description = describeAction(activity.action, activity.payload, displayName);

  // For archive events when a boardId is available, wrap the card title in a link
  // that opens the card modal so the user can view / unarchive the card.
  const cardTitle = String(activity.payload.title ?? '');
  const showCardLink =
    boardId &&
    CARD_LINK_ACTIONS.has(activity.action) &&
    cardTitle &&
    activity.entity_id;

  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
      <div className="flex-1">
        {showCardLink ? (
          <span className="text-base">
            {description.replace(cardTitle, '').replace('""', '').trim()}{' '}
            <Link
              to={`/boards/${boardId}?card=${activity.entity_id}`}
              className="font-medium underline underline-offset-2 hover:opacity-75 transition-opacity"
            >
              &ldquo;{cardTitle}&rdquo;
            </Link>
          </span>
        ) : (
          <span className="text-base">{description}</span>
        )}
        <span className="ml-2 text-xs text-muted">
          {new Date(activity.created_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default ActivityItem;
