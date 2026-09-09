// Encapsulates invite validation against the authoritative database record.
// Returns the invite record or an error descriptor.
import { db } from '../../../../common/db';

export type InviteRecord = {
  id: string;
  workspace_id: string;
  invited_email: string;
  role: string;
  accepted_at: Date | null;
  expires_at: Date;
};

export type ValidateInviteResult =
  | { ok: true; invite: InviteRecord }
  | { ok: false; reason: 'not-found' | 'invite-expired' | 'invite-already-used' };

export async function validateInvite({ token }: { token: string }): Promise<ValidateInviteResult> {
  // DB is authoritative for accepted_at and final expiry.
  const invite = await db('invites').where({ token }).first<InviteRecord | undefined>();

  if (!invite) {
    return { ok: false, reason: 'not-found' };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, reason: 'invite-expired' };
  }

  if (invite.accepted_at !== null) {
    return { ok: false, reason: 'invite-already-used' };
  }

  return { ok: true, invite };
}
