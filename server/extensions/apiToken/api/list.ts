// GET /api/v1/tokens — list all non-revoked tokens for the authenticated user.
// Never returns the raw token or hash value.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';

type ApiTokenListRow = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export async function handleListTokens(req: Request): Promise<Response> {
  const authenticatedReq = req as AuthenticatedRequest;
  const authError = await authenticate(authenticatedReq);
  if (authError) return authError;

  const userId = authenticatedReq.currentUser?.id;
  if (!userId) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Missing authenticated user' } },
      { status: 401 },
    );
  }

  const tokens = await db<ApiTokenListRow>('api_tokens')
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
