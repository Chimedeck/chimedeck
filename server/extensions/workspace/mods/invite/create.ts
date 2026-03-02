// Encapsulates invite creation: generate token, persist to DB, store in cache.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import { memCache } from '../../../../mods/cache/index';
import { inviteConfig } from '../../common/config/invite';
import type { Role } from '../../../../middlewares/permissionManager';

interface CreateInviteParams {
  workspaceId: string;
  invitedEmail: string;
  role: Role;
}

interface CreatedInvite {
  id: string;
  token: string;
  expiresAt: Date;
}

export async function createInvite({
  workspaceId,
  invitedEmail,
  role,
}: CreateInviteParams): Promise<CreatedInvite> {
  const id = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + inviteConfig.ttlSeconds * 1000);

  await db('invites').insert({
    id,
    workspace_id: workspaceId,
    invited_email: invitedEmail,
    token,
    role,
    expires_at: expiresAt,
  });

  // Fast-path: cache the token so validation skips a DB round-trip.
  memCache.set(
    `${inviteConfig.cacheKeyPrefix}${token}`,
    JSON.stringify({ id, workspaceId, invitedEmail, role, expiresAt: expiresAt.toISOString() }),
    inviteConfig.ttlSeconds,
  );

  return { id, token, expiresAt };
}
