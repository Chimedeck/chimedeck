// list.sort_by_due_date — sorts all non-archived cards in a list by due date ascending.
// Cards with no due date are sorted to the end.

import { z } from 'zod';
import { between, HIGH_SENTINEL } from '../../../../list/mods/fractional';
import type { ActionHandler, ActionContext } from '../../../../common/types';

const configSchema = z.object({
  listId: z.string().uuid(),
});

export const listSortByDueDateAction: ActionHandler = {
  type: 'list.sort_by_due_date',
  label: 'Sort list by due date',
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

    // Sort: cards with due dates ascending, then cards without due dates.
    const sorted = [...cards].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    // Assign new fractional positions in sorted order.
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
