import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';

// Config accepts either an absolute ISO date string or a relative offset in days from today.
// Exactly one of offsetDays or date must be provided.
const configSchema = z
  .object({
    offsetDays: z.number().int().optional(),
    date: z.string().datetime({ offset: true }).optional(),
  })
  .refine((d) => d.offsetDays !== undefined || d.date !== undefined, {
    message: 'Either offsetDays or date must be provided',
  });

export const cardSetDueDateAction: ActionHandler = {
  type: 'card.set_due_date',
  label: 'Set due date on card',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    let dueDate: string;
    if (config.date !== undefined) {
      dueDate = config.date;
    } else {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + (config.offsetDays ?? 0));
      dueDate = d.toISOString();
    }

    await trx('cards')
      .where({ id: cardId })
      .update({ due_date: dueDate, updated_at: new Date().toISOString() });
  },
};
