// Maps server event types to human-readable labels and UI metadata.
// Fallback for unknown event types: generic label + gray dot.
export interface ActivityEventMeta {
  label: string;
  dotColor: string; // Tailwind bg-* class
}

const EVENT_LABELS: Record<string, ActivityEventMeta> = {
  'card.member.added': { label: 'added a member', dotColor: 'bg-blue-500' },
  'card.member.removed': { label: 'removed a member', dotColor: 'bg-slate-500' },
  'card.due_date.set': { label: 'set the due date', dotColor: 'bg-yellow-500' },
  'card.due_date.cleared': { label: 'cleared the due date', dotColor: 'bg-slate-500' },
  'card.money.updated': { label: 'updated the value', dotColor: 'bg-green-500' },
};

const FALLBACK: ActivityEventMeta = { label: 'Activity', dotColor: 'bg-slate-600' };

export function getActivityEventMeta(
  eventType: string,
  payload?: Record<string, unknown>,
): ActivityEventMeta {
  if (eventType === 'attachment_added') {
    const name = typeof payload?.name === 'string' ? payload.name : 'a file';
    return { label: `attached ${name} to this card`, dotColor: 'bg-blue-400' };
  }
  if (eventType === 'attachment_removed') {
    const name = typeof payload?.name === 'string' ? payload.name : 'a file';
    return { label: `removed attachment ${name}`, dotColor: 'bg-slate-500' };
  }
  return EVENT_LABELS[eventType] ?? FALLBACK;
}
