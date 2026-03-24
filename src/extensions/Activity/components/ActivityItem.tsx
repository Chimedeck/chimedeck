// Human-readable description for a single activity event.
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
}

// Replaces {placeholders} in a translation template with values from a record.
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function describeAction(action: string, payload: Record<string, unknown>, actorName: string): string {
  const title = String(payload.title ?? payload.cardTitle ?? '');
  const cardTitle = String(payload.cardTitle ?? '');
  const fromList = String(payload.fromList ?? translations['activity.fromList.unknown']);
  const toList = String(payload.toList ?? translations['activity.toList.unknown']);

  const key = `activity.action.${action}` as keyof typeof translations;
  const template = translations[key] ?? translations['activity.action.unknown'];

  return interpolate(template, { actor: actorName, title, cardTitle, fromList, toList, action });
}

const ActivityItem = ({ activity, actorName }: Props) => {
  const displayName = actorName ?? activity.actor_id;
  const description = describeAction(activity.action, activity.payload, displayName);

  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
      <div className="flex-1">
        <span className="text-gray-100">{description}</span>
        <span className="ml-2 text-xs text-gray-400">{new Date(activity.created_at).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default ActivityItem;
