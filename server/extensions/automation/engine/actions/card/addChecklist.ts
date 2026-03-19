import { randomUUID } from 'crypto';
import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import type { ActionHandler, ActionContext } from '../../../common/types';

const configSchema = z.object({
  name: z.string().min(1).max(255),
  items: z.array(z.string().min(1).max(512)).optional(),
});

// TODO: The current DB schema has a flat checklist_items table with no named checklist groups.
// When a dedicated checklists table is added, update this to insert a checklist row first.
// For now, checklist items are appended after existing items; the checklist name is prepended
// to the first item title to preserve grouping intent.
export const cardAddChecklistAction: ActionHandler = {
  type: 'card.add_checklist',
  label: 'Add checklist to card',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    const titles = config.items && config.items.length > 0 ? config.items : [config.name];

    const lastItem = await trx('checklist_items')
      .where({ card_id: cardId })
      .orderBy('position', 'desc')
      .first();

    let prevPosition = lastItem ? lastItem.position : '';

    for (const title of titles) {
      const position = between(prevPosition, HIGH_SENTINEL);
      await trx('checklist_items').insert({
        id: randomUUID(),
        card_id: cardId,
        title,
        checked: false,
        position,
      });
      prevPosition = position;
    }
  },
};
