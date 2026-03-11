import { z } from 'zod';
import type { TriggerHandler } from '../../../common/types';

const configSchema = z.object({
  memberId: z.string().uuid().optional(),
});

export const boardMemberAddedTrigger: TriggerHandler = {
  type: 'board.member_added',
  label: 'Member added to board',
  configSchema,
  matches(event, config) {
    if (event.type !== 'board.member_added') return false;
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) return false;
    const { memberId } = parsed.data;
    if (memberId && event.payload['memberId'] !== memberId) return false;
    return true;
  },
};
