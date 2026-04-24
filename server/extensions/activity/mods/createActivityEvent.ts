// Convenience wrappers for emitting named activity events.
// Each function calls writeActivity with the correct action and payload shape
// so call sites stay declarative and payload contracts are enforced in one place.
import { writeActivity } from './write';
import { publishCardActivityEvent } from '../events/publishCardActivityEvent';
import { mapActivityToNotification } from './mapActivityToNotification';
import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { getActiveWebhooksForEvent } from '../../webhooks/mods/registry';
import { dispatchWebhook } from '../../webhooks/mods/dispatch';
import type { WebhookEventType } from '../../webhooks/common/eventTypes';

// [why] extracted helper — card member events go through writeActivity (not dispatchEvent)
// so webhooks must be fired here rather than in the central dispatch hook.
async function fireCardMemberWebhook({
  boardId,
  cardId,
  actorId,
  eventType,
  payload,
}: {
  boardId: string;
  cardId: string;
  actorId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!env.WEBHOOKS_ENABLED) return;
  const webhooks = await getActiveWebhooksForEvent({ knex: db, eventType });
  for (const wh of webhooks) {
    dispatchWebhook({
      endpoint: wh.endpoint_url,
      signingSecret: wh.signing_secret,
      eventType,
      payload: { ...payload, boardId, cardId, actorId },
      webhookId: wh.id,
      knex: db,
    });
  }
}

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
  // [why] card.create notifications are emitted by dispatchEvent ->
  // handleBoardActivityNotification in the card create API path. Emitting here
  // as well causes duplicate notifications in production.
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
  // [why] card.move notifications are emitted by dispatchEvent ->
  // handleBoardActivityNotification in the card move API path. Emitting here
  // as well causes duplicate notifications in production.
  return activity;
}

export interface CardMemberAssignedPayload {
  cardId: string;
  cardTitle: string;
  userId: string;
  assigneeName: string;
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
  fireCardMemberWebhook({
    boardId: payload.boardId,
    cardId: payload.cardId,
    actorId,
    eventType: 'card.member_assigned',
    payload: { userId: payload.userId, assigneeName: payload.assigneeName, cardTitle: payload.cardTitle },
  }).catch(() => {});
  return activity;
}

export interface CardMemberUnassignedPayload {
  cardId: string;
  cardTitle: string;
  userId: string;
  assigneeName: string;
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
  fireCardMemberWebhook({
    boardId: payload.boardId,
    cardId: payload.cardId,
    actorId,
    eventType: 'card.member_removed',
    payload: { userId: payload.userId, assigneeName: payload.assigneeName, cardTitle: payload.cardTitle },
  }).catch(() => {});
  return activity;
}
