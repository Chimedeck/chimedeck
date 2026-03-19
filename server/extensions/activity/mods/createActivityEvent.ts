// Convenience wrappers for emitting named activity events.
// Each function calls writeActivity with the correct action and payload shape
// so call sites stay declarative and payload contracts are enforced in one place.
import { writeActivity } from './write';
import { publishCardActivityEvent } from '../events/publishCardActivityEvent';
import { mapActivityToNotification } from './mapActivityToNotification';

export interface CardCreatedPayload {
  cardId: string;
  cardTitle: string;
  listId: string;
  listName?: string | null;
  boardId: string;
  workspaceId: string;
}

export async function emitCardCreated({
  actorId,
  ipAddress,
  userAgent,
  ...payload
}: CardCreatedPayload & {
  actorId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const activity = await writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_created',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
  // [why] Fire-and-forget so a WS delivery failure never blocks the API response.
  publishCardActivityEvent({ activity, boardId: payload.boardId }).catch(() => {});
  // [why] Fan-out notifications after the activity write; failures are swallowed.
  mapActivityToNotification({ activity, boardId: payload.boardId }).catch(() => {});
  return activity;
}

export interface CardMovedPayload {
  cardId: string;
  cardTitle: string;
  fromListId: string;
  fromListName?: string | null;
  toListId: string;
  toListName?: string | null;
  boardId: string;
  workspaceId: string;
}

export async function emitCardMoved({
  actorId,
  ipAddress,
  userAgent,
  ...payload
}: CardMovedPayload & {
  actorId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  // [why] Only emit if the card actually changed lists; same-list reorders are
  //        not a "move" for activity feed purposes.
  if (payload.fromListId === payload.toListId) return null;
  const activity = await writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_moved',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
  publishCardActivityEvent({ activity, boardId: payload.boardId }).catch(() => {});
  mapActivityToNotification({ activity, boardId: payload.boardId }).catch(() => {});
  return activity;
}

export interface CardMemberAssignedPayload {
  cardId: string;
  cardTitle: string;
  userId: string;
  boardId: string;
  workspaceId: string;
}

export async function emitCardMemberAssigned({
  actorId,
  ipAddress,
  userAgent,
  ...payload
}: CardMemberAssignedPayload & {
  actorId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const activity = await writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_member_assigned',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
  publishCardActivityEvent({ activity, boardId: payload.boardId }).catch(() => {});
  mapActivityToNotification({ activity, boardId: payload.boardId }).catch(() => {});
  return activity;
}

export interface CardMemberUnassignedPayload {
  cardId: string;
  cardTitle: string;
  userId: string;
  boardId: string;
  workspaceId: string;
}

export async function emitCardMemberUnassigned({
  actorId,
  ipAddress,
  userAgent,
  ...payload
}: CardMemberUnassignedPayload & {
  actorId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const activity = await writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_member_unassigned',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
  publishCardActivityEvent({ activity, boardId: payload.boardId }).catch(() => {});
  mapActivityToNotification({ activity, boardId: payload.boardId }).catch(() => {});
  return activity;
}
