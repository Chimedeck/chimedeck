// POST /api/v1/tokens — create a new API token for the authenticated user.
// The raw hf_ token is returned exactly once; only the hash is stored.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { generateApiToken } from '../mods/generate';

export async function handleCreateToken(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const userId = (req as AuthenticatedRequest).currentUser!.id;

  let body: { name?: string; expiresAt?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'name is required' } },
      { status: 400 },
    );
  }

  if (body.expiresAt !== undefined && body.expiresAt !== null && isNaN(Date.parse(body.expiresAt))) {
    return Response.json(
      { name: 'bad-request', data: { message: 'expiresAt must be a valid ISO timestamp or null' } },
      { status: 400 },
    );
  }

  const { raw, hash, prefix } = await generateApiToken();
  const id = randomUUID();
  const now = new Date().toISOString();

  await db('api_tokens').insert({
    id,
    user_id: userId,
    name: body.name.trim(),
    token_hash: hash,
    token_prefix: prefix,
    expires_at: body.expiresAt ?? null,
    created_at: now,
  });

  return Response.json(
    {
      data: {
        id,
        name: body.name.trim(),
        token: raw,
        prefix,
        expiresAt: body.expiresAt ?? null,
        createdAt: now,
      },
    },
    { status: 201 },
  );
}
