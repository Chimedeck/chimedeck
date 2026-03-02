// GET /api/v1/invites/:token — inspect invite status; no authentication required.
import { db } from '../../../../common/db';

export async function handleInspectInvite(req: Request, token: string): Promise<Response> {
  const invite = await db('invites').where({ token }).first();

  if (!invite) {
    return Response.json(
      { name: 'invite-not-found', data: { message: 'Invite not found' } },
      { status: 404 },
    );
  }

  const expired = new Date(invite.expires_at) < new Date();
  const used = invite.accepted_at !== null;

  return Response.json({
    data: {
      id: invite.id,
      workspace_id: invite.workspace_id,
      invited_email: invite.invited_email,
      role: invite.role,
      expires_at: invite.expires_at,
      accepted_at: invite.accepted_at,
      expired,
      used,
    },
  });
}
