import { publishCardActivityEvent } from '../../activity/events/publishCardActivityEvent';
import { writeActivity } from '../../activity/mods/write';

type EmitCardMoveBlockedActivityInput = {
  cardId: string;
  boardId: string;
  actorId: string;
  fromListId: string;
  fromListName: string;
  toListId: string;
  toListName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function emitCardMoveBlockedActivity({
  cardId,
  boardId,
  actorId,
  fromListId,
  fromListName,
  toListId,
  toListName,
  ipAddress,
  userAgent,
}: EmitCardMoveBlockedActivityInput) {
  const activity = await writeActivity({
    entityType: 'card',
    entityId: cardId,
    boardId,
    action: 'card_move_blocked',
    actorId,
    payload: {
      cardId,
      boardId,
      fromListId,
      fromListName,
      toListId,
      toListName,
    },
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });

  publishCardActivityEvent({ activity, boardId }).catch(() => {});
  return activity;
}
