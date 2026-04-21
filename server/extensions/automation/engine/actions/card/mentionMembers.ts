import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { ActionHandler, ActionContext } from '../../../common/types';
import { generateUniqueShortId } from '../../../../../common/ids/shortId';

const configSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
  // Optional extra text appended after the @mention(s).
  text: z.string().max(10000).optional(),
});

export const cardMentionMembersAction: ActionHandler = {
  type: 'card.mention_members',
  label: 'Mention members in a comment',
  category: 'card',
  configSchema,
  async execute({ action, evalContext, trx }: ActionContext): Promise<void> {
    const config = configSchema.parse(action.config);
    const cardId = evalContext.cardId;
    if (!cardId) throw new Error('card-id-missing');

    const card = await trx('cards').where({ id: cardId }).first();
    if (!card) throw new Error('card-not-found');

    // Resolve display names for all requested members.
    const users = await trx('users').whereIn('id', config.memberIds).select('id', 'display_name', 'full_name');
    if (users.length === 0) throw new Error('mention-members-not-found');

    const mentions = users
      .map((u: { display_name?: string; full_name?: string }) => `@${u.display_name ?? u.full_name ?? 'unknown'}`)
      .join(' ');

    const content = config.text ? `${mentions} ${config.text}` : mentions;
    const shortId = await generateUniqueShortId('comments');

    await trx('comments').insert({
      id: randomUUID(),
      short_id: shortId,
      card_id: cardId,
      user_id: evalContext.actorId ?? null,
      content,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  },
};
