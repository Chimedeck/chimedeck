import { randomUUID } from 'crypto';
import { z } from 'zod';
import { substituteVariables } from '../variables';
import type { ActionHandler, ActionContext } from '../../../common/types';
import { generateUniqueShortId } from '../../../../../common/ids/shortId';

const configSchema = z.object({
  // text supports {cardName}, {boardName}, {listName}, {date}, {dueDate}, {triggerMember}
  text: z.string().min(1).max(10000),
});

export const cardAddCommentAction: ActionHandler = {
  type: 'card.add_comment',
  label: 'Add comment to card',
  category: 'card',
  configSchema,
  async execute({ action, automation, event, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const resolvedText = await substituteVariables(config.text, {
      cardId,
      boardId: automation.board_id,
      actorId: evalContext.actorId as string | null,
      trx,
    });

    const shortId = await generateUniqueShortId('comments');

    await trx('comments').insert({
      id: randomUUID(),
      short_id: shortId,
      card_id: cardId,
      user_id: evalContext.actorId ?? null,
      content: resolvedText,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  },
};
