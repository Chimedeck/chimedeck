// Convenience wrappers for emitting named activity events.
// Each function calls writeActivity with the correct action and payload shape
// so call sites stay declarative and payload contracts are enforced in one place.
import { writeActivity } from './write';

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
  return writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_created',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
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
  return writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_moved',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
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
  return writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_member_assigned',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
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
  return writeActivity({
    entityType: 'card',
    entityId: payload.cardId,
    boardId: payload.boardId,
    action: 'card_member_unassigned',
    actorId,
    payload,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
}
