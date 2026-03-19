import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  memberId: z.string().uuid(),
});

export const cardAddMemberAction: ActionHandler = {
  type: 'card.add_member',
  label: 'Add member to card',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const user = await trx('users').where({ id: config.memberId }).first();
    if (!user) throw new Error('member-not-found');

    // Idempotent: skip if already assigned
    const existing = await trx('card_members')
      .where({ card_id: cardId, user_id: config.memberId })
      .first();
    if (!existing) {
      await trx('card_members').insert({
        card_id: cardId,
        user_id: config.memberId,
        created_at: new Date().toISOString(),
      });
    }
  },
};
