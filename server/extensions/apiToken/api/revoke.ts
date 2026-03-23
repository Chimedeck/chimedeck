// DELETE /api/v1/tokens/:id — revoke an API token by setting revoked_at.
// Returns 404 if the token does not belong to the authenticated user.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleRevokeToken(req: Request, tokenId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const token = await db('api_tokens').where({ id: tokenId }).first();

  if (!token || token.user_id !== userId) {
    return Response.json(
      { name: 'token-not-found', data: { message: 'Token not found' } },
      { status: 404 },
    );
  }

  await db('api_tokens').where({ id: tokenId }).update({ revoked_at: new Date().toISOString() });

  return Response.json({ data: {} });
}
