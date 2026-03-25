import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  labelId: z.string().min(1),
});

export const cardRemoveLabelAction: ActionHandler = {
  type: 'card.remove_label',
  label: 'Remove label from card',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    // Idempotent: no-op if not attached
    await trx('card_labels')
      .where({ card_id: cardId, label_id: config.labelId })
      .delete();
  },
};
