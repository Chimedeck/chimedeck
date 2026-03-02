// Human-readable description for a single activity event.
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
}

function describeAction(action: string, payload: Record<string, unknown>, actorName: string): string {
  const actor = actorName;
  switch (action) {
    case 'card_created':
      return `${actor} created card "${payload.title ?? payload.cardTitle ?? ''}"`;
    case 'card_moved':
      return `${actor} moved "${payload.title ?? payload.cardTitle ?? ''}" from ${payload.fromList ?? 'unknown'} to ${payload.toList ?? 'unknown'}`;
    case 'card_archived':
      return `${actor} archived card "${payload.title ?? payload.cardTitle ?? ''}"`;
    case 'card_updated':
      return `${actor} updated card "${payload.title ?? payload.cardTitle ?? ''}"`;
    case 'card_deleted':
      return `${actor} deleted a card`;
    case 'comment_added':
      return `${actor} commented on card "${payload.cardTitle ?? ''}"`;
    case 'comment_edited':
      return `${actor} edited a comment`;
    case 'comment_deleted':
      return `${actor} deleted a comment`;
    case 'list_created':
      return `${actor} created list "${payload.title ?? ''}"`;
    case 'list_updated':
      return `${actor} updated list "${payload.title ?? ''}"`;
    case 'list_archived':
      return `${actor} archived list "${payload.title ?? ''}"`;
    case 'board_created':
      return `${actor} created board "${payload.title ?? ''}"`;
    case 'board_updated':
      return `${actor} updated board settings`;
    case 'member_assigned':
      return `${actor} assigned a member to the card`;
    case 'member_removed':
      return `${actor} removed a member from the card`;
    case 'label_attached':
      return `${actor} added a label to the card`;
    case 'label_detached':
      return `${actor} removed a label from the card`;
    default:
      return `${actor} performed ${action}`;
  }
}

const ActivityItem = ({ activity, actorName }: Props) => {
  const displayName = actorName ?? activity.actor_id;
  const description = describeAction(activity.action, activity.payload, displayName);

  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
      <div className="flex-1">
        <span className="text-gray-800">{description}</span>
        <span className="ml-2 text-xs text-gray-400">{new Date(activity.created_at).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default ActivityItem;
