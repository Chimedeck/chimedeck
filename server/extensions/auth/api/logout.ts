// DELETE /api/v1/auth/session — revoke the refresh token and close the session.
import { db } from '../../../common/db';
import { pubsub } from '../../../mods/pubsub/index';

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export async function handleLogout(req: Request): Promise<Response> {
  const cookieHeader = req.headers.get('cookie');
  const refreshToken = parseCookie(cookieHeader, 'refresh_token');

  if (refreshToken) {
    // Fetch the token row to get the userId before revoking.
    const tokenRow = await db('refresh_tokens')
      .where({ token: refreshToken })
      .whereNull('revoked_at')
      .first();

    // Mark token as revoked immediately.
    await db('refresh_tokens')
      .where({ token: refreshToken })
      .whereNull('revoked_at')
      .update({ revoked_at: new Date() });

    // Notify any open WebSocket connections for this user to close (code 4001).
    if (tokenRow?.user_id) {
      await pubsub.publish(
        `session:${tokenRow.user_id}`,
        JSON.stringify({ type: 'session_revoked' }),
      );
    }
  }

  const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
  // Clear the cookie by setting Max-Age=0.
  responseHeaders.append(
    'Set-Cookie',
    'refresh_token=; HttpOnly; Path=/api/v1/auth/refresh; SameSite=Strict; Secure; Max-Age=0',
  );

  return new Response(JSON.stringify({ data: {} }), { status: 200, headers: responseHeaders });
}
