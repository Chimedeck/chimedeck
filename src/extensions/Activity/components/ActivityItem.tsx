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
  /** Board id — when supplied, card title in activity text becomes a clickable link. */
  boardId?: string;
}

// Replaces {placeholders} in a translation template with values from a record.
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replaceAll(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function describeAction(
  action: string,
  payload: Record<string, unknown>,
  actorName: string
): string {
  const title = textValue(payload.title) || textValue(payload.cardTitle);
  const cardTitle = textValue(payload.cardTitle) || textValue(payload.title);
  const fromList =
    textValue(payload.fromListName) ||
    textValue(payload.fromList) ||
    translations['activity.fromList.unknown'];
  const toList =
    textValue(payload.toListName) || textValue(payload.toList) || translations['activity.toList.unknown'];
  const checklistTitle = textValue(payload.checklistTitle);
  const itemTitle = textValue(payload.itemTitle);
  const commentPreview = textValue(payload.commentPreview);
  const name = textValue(payload.name);
  const assigneeName = textValue(payload.assigneeName);

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

  const cardTitle = textValue(activity.payload.cardTitle) || textValue(activity.payload.title);
  let cardId: string | null = null;
  if (activity.entity_type === 'card') {
    cardId = activity.entity_id;
  } else {
    const payloadCardId = activity.payload.cardId;
    if (typeof payloadCardId === 'string' && payloadCardId.length > 0) {
      cardId = payloadCardId;
    }
  }
  const showCardLink = Boolean(boardId && cardTitle && cardId);

  const renderDescription = () => {
    if (!showCardLink || !boardId || !cardId) {
      return <span className="text-base">{description}</span>;
    }

    const quotedCardTitle = `"${cardTitle}"`;
    const titleIndex = description.indexOf(quotedCardTitle);

    if (titleIndex === -1) {
      return <span className="text-base">{description}</span>;
    }

    const before = description.slice(0, titleIndex);
    const after = description.slice(titleIndex + quotedCardTitle.length);

    return (
      <span className="text-base">
        {before}
        <Link
          to={`/boards/${boardId}?card=${cardId}`}
          className="font-medium underline underline-offset-2 transition-opacity hover:opacity-75"
        >
          &ldquo;{cardTitle}&rdquo;
        </Link>
        {after}
      </span>
    );
  };

  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
      <div className="flex-1">
        {renderDescription()}
        <span className="ml-2 text-xs text-muted">
          {new Date(activity.created_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default ActivityItem;
