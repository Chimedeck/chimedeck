import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

// Existence-query columns from 0002_auth, 0006_card and 0007_card_extended.
interface EntityIdRow {
  id: string;
}

interface CardMemberRow {
  card_id: string;
  user_id: string;
}

const configSchema = z.object({
  memberId: z.string().min(1),
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

    const card = await trx<EntityIdRow>('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const user = await trx<EntityIdRow>('users').where({ id: config.memberId }).first();
    if (!user) throw new Error('member-not-found');

    // Idempotent: skip if already assigned
    const existing = await trx<CardMemberRow>('card_members')
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
