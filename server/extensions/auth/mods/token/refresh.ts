// Rotates a refresh token: marks old token revoked, inserts a new one.
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../../common/db';
import { jwtConfig } from '../../common/config/jwt';

interface RotateResult {
  status: 200 | 401;
  token?: string;
  userId?: string;
  name?: string;
}

// Validates old refresh token, revokes it, and returns a fresh opaque token.
export async function rotateRefreshToken({ token }: { token: string }): Promise<RotateResult> {
  const now = new Date();

  const row = await db('refresh_tokens')
    .where({ token })
    .whereNull('revoked_at')
    .where('expires_at', '>', now)
    .first();

  if (!row) {
    return { status: 401, name: 'refresh-token-invalid' };
  }

  // Revoke the old token.
  await db('refresh_tokens').where({ id: row.id }).update({ revoked_at: now });

  // Issue a new refresh token.
  const newToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(now.getTime() + jwtConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: uuidv4(),
    user_id: row.user_id,
    token: newToken,
    expires_at: expiresAt,
    created_at: now,
  });

  return { status: 200, token: newToken, userId: row.user_id };
}
