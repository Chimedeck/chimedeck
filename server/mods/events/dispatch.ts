// server/mods/events/dispatch.ts
// Writes an event and fire-and-forget triggers automation evaluation,
// board activity email notifications, and outgoing webhook deliveries.
// Failures in any downstream hook are swallowed and must never block card mutations.

import { writeEvent, type WriteEventInput, type WrittenEvent } from './index';
import { automationConfig } from '../../extensions/automation/config';
import { handleBoardActivityNotification } from '../../extensions/notifications/mods/boardActivityDispatch';
import { db } from '../../common/db';
import { env } from '../../config/env';
import { getActiveWebhooksForEvent } from '../../extensions/webhooks/mods/registry';
import { dispatchWebhook } from '../../extensions/webhooks/mods/dispatch';
import type { WebhookEventType } from '../../extensions/webhooks/common/eventTypes';

// [why] Maps internal event type names to their webhook event type aliases.
// comment_added is the internal type but subscribers register as card.commented / card_commented.
const INTERNAL_TO_WEBHOOK_TYPES: Partial<Record<string, WebhookEventType[]>> = {
  'card.created': ['card.created', 'card_created'],
  'card.updated': ['card.updated', 'card_updated'],
  'card.deleted': ['card.deleted', 'card_deleted'],
  'card.archived': ['card.archived', 'card_archived'],
  'card.description_edited': ['card.description_edited'],
  // [why] attachment_added is the internal event name; card.attachment_added is the webhook alias
  attachment_added: ['card.attachment_added'],
  'card.attachment_added': ['card.attachment_added'],
  'card.member_assigned': ['card.member_assigned', 'card_member_assigned'],
  'card.member_removed': ['card.member_removed', 'card_member_unassigned'],
  'card.moved': ['card.moved', 'card_moved'],
  // [why] comment_added is used internally; card.commented is the webhook-facing alias
  comment_added: ['card.commented', 'card_commented'],
  'card.commented': ['card.commented', 'card_commented'],
  // [why] board_created is the internal event name emitted by board/api/create.ts
  board_created: ['board.created'],
  'board.created': ['board.created'],
  // [why] board_member_added is the internal event name emitted by board/api/members/create.ts
  board_member_added: ['board.member_added'],
  'board.member_added': ['board.member_added'],
};

export async function dispatchEvent(input: WriteEventInput): Promise<WrittenEvent> {
  const event = await writeEvent(input);

  // Fire-and-forget automation evaluation — must not block or throw.
  if (automationConfig.enabled && event.board_id) {
    import('../../extensions/automation/engine/index')
      .then(({ evaluate }) =>
        evaluate({
          boardId: event.board_id as string,
          event: {
            type: event.type,
            boardId: event.board_id as string,
            entityId: event.entity_id,
            actorId: event.actor_id,
            payload: event.payload,
          },
          context: {
            actorId: event.actor_id,
            // For card.* events, entityId is the card ID — actions need it.
            ...(event.type.startsWith('card.') ? { cardId: event.entity_id } : {}),
          },
        })
      )
      .catch(() => {
        // Automation errors must never propagate to the caller.
      });
  }

  // Fire-and-forget board activity email notifications.
  // Handles card.created and card.moved events (comment_added is dispatched directly from create.ts).
  if (event.board_id && event.actor_id) {
    handleBoardActivityNotification({
      event,
      boardId: event.board_id,
      actorId: event.actor_id,
    }).catch(() => {
      // Notification errors must never propagate to the caller.
    });
  }

  // Fire-and-forget outgoing webhook deliveries.
  if (env.WEBHOOKS_ENABLED) {
    const webhookEventTypes = INTERNAL_TO_WEBHOOK_TYPES[event.type];
    if (webhookEventTypes) {
      (async () => {
        try {
          // Collect unique webhooks across all alias types — prevents double-delivery to a webhook
          // that is subscribed to both dot-notation and underscore alias of the same event.
          const seen = new Map<
            string,
            {
              webhook: Awaited<ReturnType<typeof getActiveWebhooksForEvent>>[number];
              eventType: WebhookEventType;
            }
          >();
          for (const webhookEventType of webhookEventTypes) {
            const webhooks = await getActiveWebhooksForEvent({
              knex: db,
              eventType: webhookEventType,
            });
            for (const wh of webhooks) {
              if (!seen.has(wh.id)) seen.set(wh.id, { webhook: wh, eventType: webhookEventType });
            }
          }

          for (const { webhook, eventType } of seen.values()) {
            void dispatchWebhook({
              endpoint: webhook.endpoint_url,
              signingSecret: webhook.signing_secret,
              eventType,
              payload: {
                ...event.payload,
                boardId: event.board_id,
                entityId: event.entity_id,
                actorId: event.actor_id,
              },
              webhookId: webhook.id,
              knex: db,
            });
          }
        } catch {
          // Webhook errors must never propagate to the caller.
        }
      })().catch(() => {});
    }
  }

  return event;
}
