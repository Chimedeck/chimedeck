// boardActivityDispatch.ts — Fire-and-forget email notification dispatch for board-level events.
// Called from the events pipeline after event persistence. Fetches board members
// and dispatches email notifications via dispatchNotificationEmail.
// Failures are logged and never propagate — this must not block mutations.
import { db } from '../../../common/db';
import { dispatchNotificationEmail } from './emailDispatch';
import type { WrittenEvent } from '../../../mods/events/index';

type SupportedEventType = 'card.created' | 'card.moved' | 'comment_added';

const SUPPORTED_EVENTS = new Set<string>(['card.created', 'card.moved', 'comment_added']);

export async function handleBoardActivityNotification({
  event,
  boardId,
  actorId,
}: {
  event: WrittenEvent;
  boardId: string;
  actorId: string;
}): Promise<void> {
  if (!SUPPORTED_EVENTS.has(event.type)) return;

  try {
    const board = await db('boards').where({ id: boardId }).select('id', 'title', 'workspace_id').first();
    if (!board) return;

    // Fetch all workspace members excluding the actor (board access is workspace-scoped)
    const members = await db('memberships')
      .where({ workspace_id: board.workspace_id })
      .whereNot({ user_id: actorId })
      .select('user_id');

    if (members.length === 0) return;

    const recipientIds = members.map((m: { user_id: string }) => m.user_id);

    const templateData = await buildTemplateData({
      eventType: event.type as SupportedEventType,
      event,
      boardName: board.title,
      actorId,
    });
    if (!templateData) return;

    const notificationType = eventTypeToNotificationType(event.type as SupportedEventType);

    // Fire-and-forget per recipient — failures never block the mutation path
    for (const recipientId of recipientIds) {
      dispatchNotificationEmail({
        recipientId,
        type: notificationType,
        templateData,
      }).catch(() => {
        // Per-recipient email failures are silently swallowed
      });
    }
  } catch (err) {
    console.warn('[boardActivityDispatch] Failed to dispatch board activity notifications:', err);
  }
}

function eventTypeToNotificationType(eventType: SupportedEventType) {
  switch (eventType) {
    case 'card.created': return 'card_created' as const;
    case 'card.moved': return 'card_moved' as const;
    case 'comment_added': return 'card_commented' as const;
  }
}

async function buildTemplateData({
  eventType,
  event,
  boardName,
  actorId,
}: {
  eventType: SupportedEventType;
  event: WrittenEvent;
  boardName: string;
  actorId: string;
}): Promise<Record<string, string> | null> {
  const payload = event.payload as Record<string, unknown>;

  if (eventType === 'card.created') {
    const card = payload.card as { id: string; title: string; list_id: string } | undefined;
    if (!card) return null;
    const list = await db('lists').where({ id: card.list_id }).select('name').first();
    const cardUrl = `/boards/${event.board_id}/cards/${card.id}`;
    return {
      cardTitle: card.title,
      boardName,
      listName: list?.name ?? '',
      cardUrl,
    };
  }

  if (eventType === 'card.moved') {
    const card = payload.card as { id: string; title: string; list_id: string } | undefined;
    if (!card) return null;
    const fromListId = payload.fromListId as string | undefined;
    const [toList, fromList] = await Promise.all([
      db('lists').where({ id: card.list_id }).select('name').first(),
      fromListId ? db('lists').where({ id: fromListId }).select('name').first() : Promise.resolve(null),
    ]);
    const cardUrl = `/boards/${event.board_id}/cards/${card.id}`;
    return {
      cardTitle: card.title,
      boardName,
      fromList: fromList?.name ?? '',
      toList: toList?.name ?? '',
      cardUrl,
    };
  }

  if (eventType === 'comment_added') {
    const cardId = payload.cardId as string | undefined;
    const cardTitle = payload.cardTitle as string | undefined;
    if (!cardId) return null;

    const actor = await db('users')
      .where({ id: actorId })
      .select(db.raw("COALESCE(name, email) as name"))
      .first();

    const comment = await db('comments')
      .where({ card_id: cardId })
      .orderBy('created_at', 'desc')
      .select('content')
      .first();

    const cardUrl = `/boards/${event.board_id}/cards/${cardId}`;
    // Provide a short preview of the comment (strip HTML tags, max 120 chars)
    const commentText = (comment?.content ?? '').replace(/<[^>]+>/g, '');
    const commentPreview = commentText.length > 120 ? commentText.slice(0, 117) + '…' : commentText;

    return {
      actorName: actor?.name ?? 'Someone',
      cardTitle: cardTitle ?? '',
      boardName,
      commentPreview,
      cardUrl,
    };
  }

  return null;
}
