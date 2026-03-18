// Maps server event types to human-readable labels and UI metadata.
// Fallback for unknown event types: generic label + gray dot.
export interface ActivityEventMeta {
  label: string;
  dotColor: string; // Tailwind bg-* class
}

// [why] Optional context lets the label builder resolve user names from the board
// member map without coupling this module to React state or component props.
export interface ActivityEventContext {
  /** Look up a display name for a given user id; return undefined if unknown. */
  resolveName?: (userId: string) => string | undefined;
  /** The id of the currently authenticated user, for "yourself" copy. */
  currentUserId?: string;
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
  context?: ActivityEventContext,
): ActivityEventMeta {
  // --- Sprint 88: card lifecycle events ---

  if (eventType === 'card_created') {
    return { label: 'created this card', dotColor: 'bg-emerald-500' };
  }

  if (eventType === 'card_moved') {
    const from = typeof payload?.fromListName === 'string' ? payload.fromListName : null;
    const to = typeof payload?.toListName === 'string' ? payload.toListName : null;
    if (from && to) {
      return { label: `moved this card from ${from} to ${to}`, dotColor: 'bg-blue-500' };
    }
    return { label: 'moved this card', dotColor: 'bg-blue-500' };
  }

  if (eventType === 'card_member_assigned') {
    const userId = typeof payload?.userId === 'string' ? payload.userId : null;
    const isSelf = userId != null && userId === context?.currentUserId;
    if (isSelf) {
      return { label: 'assigned themselves to this card', dotColor: 'bg-blue-400' };
    }
    const name = userId ? (context?.resolveName?.(userId) ?? null) : null;
    const who = name ?? 'a member';
    return { label: `assigned ${who} to this card`, dotColor: 'bg-blue-400' };
  }

  if (eventType === 'card_member_unassigned') {
    const userId = typeof payload?.userId === 'string' ? payload.userId : null;
    const isSelf = userId != null && userId === context?.currentUserId;
    if (isSelf) {
      return { label: 'removed themselves from this card', dotColor: 'bg-slate-500' };
    }
    const name = userId ? (context?.resolveName?.(userId) ?? null) : null;
    const who = name ?? 'a member';
    return { label: `removed ${who} from this card`, dotColor: 'bg-slate-500' };
  }

  // --- Attachment events ---

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
