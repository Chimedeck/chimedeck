import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  memberId: z.string().uuid().optional(),
});

export const cardMemberAddedTrigger: TriggerHandler = {
  type: 'card.member_added',
  label: 'Member assigned to card',
  configSchema,
  matches(event, config) {
    if (event.type !== 'card.member_added') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    const { memberId } = parsed.data;
    if (memberId && event.payload['memberId'] !== memberId) return false;
    return true;
  },
};
