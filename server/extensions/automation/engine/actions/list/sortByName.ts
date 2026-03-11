// list.sort_by_name — sorts all non-archived cards in a list alphabetically by title.

import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import type { ActionHandler, ActionContext } from '../../../../common/types';

const configSchema = z.object({
  listId: z.string().uuid(),
});

export const listSortByNameAction: ActionHandler = {
  type: 'list.sort_by_name',
  label: 'Sort list by name',
  category: 'list',
  configSchema,
  async execute({ action, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);

    const list = await trx('lists').where({ id: config.listId }).first();
    if (!list) throw new Error('list-not-found');

    const cards = await trx('cards')
      .where({ list_id: config.listId, archived: false })
      .orderBy('position', 'asc');

    if (cards.length < 2) return;

    const sorted = [...cards].sort((a, b) =>
      (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }),
    );

    let prev = '';
    for (const card of sorted) {
      const newPos = between(prev, HIGH_SENTINEL);
      await trx('cards')
        .where({ id: card.id })
        .update({ position: newPos, updated_at: new Date().toISOString() });
      prev = newPos;
    }
  },
};
