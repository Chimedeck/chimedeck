import { db } from '../../../common/db';
import type { NotificationType } from './preferenceGuard';

const CARD_RELATION_REQUIRED_TYPES = new Set<NotificationType>([
  'card_moved',
  'card_member_assigned',
  'card_member_unassigned',
  'checklist_item_assigned',
  'checklist_item_unassigned',
  'checklist_item_due_date_updated',
  'card_updated',
  'card_deleted',
  'card_archived',
  'card_commented',
]);

export async function getCardRelatedUserIds({
  cardId,
}: {
  cardId: string | null;
}): Promise<Set<string>> {
  if (!cardId) return new Set<string>();

  const [cardMemberRows, checklistAssigneeRows] = await Promise.all([
    db('card_members')
      .where({ card_id: cardId })
      .select('user_id'),
    db('checklist_items')
      .where({ card_id: cardId })
      .whereNotNull('assigned_member_id')
      .select('assigned_member_id'),
  ]);

  const relatedUserIds = new Set<string>();

  for (const row of cardMemberRows as Array<{ user_id: string }>) {
    relatedUserIds.add(row.user_id);
  }

  for (const row of checklistAssigneeRows as Array<{ assigned_member_id: string }>) {
    relatedUserIds.add(row.assigned_member_id);
  }

  return relatedUserIds;
}

export function isRecipientRelatedCardNotification({
  type,
  recipientId,
  relatedUserIds,
  replyToUserId,
  targetUserId,
}: {
  type: NotificationType;
  recipientId: string;
  relatedUserIds: ReadonlySet<string>;
  replyToUserId?: string | null;
  targetUserId?: string | null;
}): boolean {
  if (type === 'card_created') return false;

  if (type === 'card_commented' && replyToUserId && recipientId === replyToUserId) {
    return true;
  }

  if (
    (type === 'card_member_assigned' || type === 'card_member_unassigned')
    && targetUserId
    && recipientId === targetUserId
  ) {
    return true;
  }

  if (!CARD_RELATION_REQUIRED_TYPES.has(type)) {
    return true;
  }

  return relatedUserIds.has(recipientId);
}
