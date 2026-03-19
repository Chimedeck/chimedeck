import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  labelId: z.string().uuid(),
});

export const cardAddLabelAction: ActionHandler = {
  type: 'card.add_label',
  label: 'Add label to card',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const label = await trx('labels').where({ id: config.labelId }).first();
    if (!label) throw new Error('label-not-found');

    // Idempotent: skip if already attached
    const existing = await trx('card_labels')
      .where({ card_id: cardId, label_id: config.labelId })
      .first();
    if (!existing) {
      await trx('card_labels').insert({ card_id: cardId, label_id: config.labelId });
    }
  },
};
