// list.archive_all_cards — archives every non-archived card in a list atomically.

import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../../common/types';

const configSchema = z.object({
  listId: z.string().min(1),
});

export const listArchiveAllCardsAction: ActionHandler = {
  type: 'list.archive_all_cards',
  label: 'Archive all cards in list',
  category: 'list',
  configSchema,
  async execute({ action, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);

    const list = await trx('lists').where({ id: config.listId }).first();
    if (!list) throw new Error('list-not-found');

    await trx('cards')
      .where({ list_id: config.listId, archived: false })
      .update({ archived: true, updated_at: new Date().toISOString() });
  },
};
