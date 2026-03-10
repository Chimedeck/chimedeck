// POST /api/v1/invites/:token/accept — accept an invite; caller must be authenticated.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { validateInvite } from '../../mods/invite/validate';
import { consumeInvite } from '../../mods/invite/consume';

export async function handleAcceptInvite(req: Request, token: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const { currentUser } = req as AuthenticatedRequest;

  const result = await validateInvite({ token });

  if (!result.ok) {
    if (result.reason === 'not-found') {
      return Response.json(
        { error: { code: 'invite-not-found', message: 'Invite not found' } },
        { status: 404 },
      );
    }
    if (result.reason === 'invite-expired') {
      return Response.json(
        { error: { code: 'invite-expired', message: 'Invite has expired' } },
        { status: 410 },
      );
    }
    if (result.reason === 'invite-already-used') {
      return Response.json(
        { error: { code: 'invite-already-used', message: 'Invite has already been used' } },
        { status: 409 },
      );
    }
  }

  const { invite } = result as Extract<typeof result, { ok: true }>;

  await consumeInvite({ invite, userId: currentUser!.id });

  return Response.json({
    data: {
      workspace_id: invite.workspace_id,
      role: invite.role,
    },
  });
}
