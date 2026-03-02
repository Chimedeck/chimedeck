// Encapsulates invite consumption: mark acceptedAt, create Membership, evict cache.
import { db } from '../../../../common/db';
import { memCache } from '../../../../mods/cache/index';
import { inviteConfig } from '../../common/config/invite';
import type { InviteRecord } from './validate';

interface ConsumeInviteParams {
  invite: InviteRecord;
  userId: string;
}

export async function consumeInvite({ invite, userId }: ConsumeInviteParams): Promise<void> {
  await db.transaction(async (trx) => {
    // Mark invite as used.
    await trx('invites')
      .where({ id: invite.id })
      .update({ accepted_at: new Date() });

    // Upsert membership — idempotent if user somehow already a member.
    const existing = await trx('memberships')
      .where({ user_id: userId, workspace_id: invite.workspace_id })
      .first();

    if (!existing) {
      await trx('memberships').insert({
        user_id: userId,
        workspace_id: invite.workspace_id,
        role: invite.role,
      });
    }
  });

  // Evict cache so validate() won't serve a stale hit.
  memCache.del(`${inviteConfig.cacheKeyPrefix}${invite.id}`);
}
