// GET /api/v1/tokens — list all non-revoked tokens for the authenticated user.
// Never returns the raw token or hash value.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

export async function handleListTokens(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  const tokens = await db('api_tokens')
    .where({ user_id: userId })
    .whereNull('revoked_at')
    .orderBy('created_at', 'desc')
    .select('id', 'name', 'token_prefix', 'expires_at', 'last_used_at', 'created_at');

  return Response.json({
    data: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.token_prefix,
      expiresAt: t.expires_at ?? null,
      lastUsedAt: t.last_used_at ?? null,
      createdAt: t.created_at,
    })),
  });
}
