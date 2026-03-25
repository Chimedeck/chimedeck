import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  memberId: z.string().min(1),
});

export const cardRemoveMemberAction: ActionHandler = {
  type: 'card.remove_member',
  label: 'Remove member from card',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    // Idempotent: no-op if not assigned
    await trx('card_members')
      .where({ card_id: cardId, user_id: config.memberId })
      .delete();
  },
};
