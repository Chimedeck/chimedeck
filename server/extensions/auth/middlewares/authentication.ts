// Extracts and verifies credentials from the request.
// Priority: Authorization: Bearer <token>  >  access_token httpOnly cookie.
// Cookie fallback enables browser resource requests (img tags, downloads) to
// authenticate without JS intervention.
// Accepts both RS256 JWT tokens and hf_ API tokens as Bearer credentials.
// Attaches the decoded user payload to request extensions for downstream handlers.
// Deny-first: returns 401 immediately on missing or invalid token.
import { db } from '../../../common/db';
import { verifyAccessToken } from '../mods/token/verify';

export interface AuthenticatedRequest extends Request {
  currentUser?: {
    id: string;
    email: string;
  };
}

const unauthorized = (message: string) =>
  Response.json({ error: { code: 'unauthorized', message } }, { status: 401 });

// Authenticates an hf_ API token by SHA-256 hash lookup.
// Rejects revoked and expired tokens (deny-first).
async function authenticateApiToken(
  req: AuthenticatedRequest,
  token: string,
): Promise<Response | null> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const row = await db('api_tokens')
    .join('users', 'api_tokens.user_id', 'users.id')
    .where('api_tokens.token_hash', hash)
    .select('api_tokens.id', 'api_tokens.user_id', 'api_tokens.revoked_at', 'api_tokens.expires_at', 'users.email')
    .first();

  if (!row) return unauthorized('Invalid API token');
  if (row.revoked_at) return unauthorized('API token has been revoked');
  if (row.expires_at && new Date(row.expires_at) < new Date()) return unauthorized('API token has expired');

  // [why] Update last_used_at asynchronously — we don't block the request on this write.
  db('api_tokens').where('id', row.id).update({ last_used_at: new Date() }).catch(() => {});

  req.currentUser = { id: row.user_id, email: row.email };
  return null;
}

function parseCookieToken(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  const match = /(?:^|;\s*)access_token=([^;]+)/.exec(header);
  return match ? decodeURIComponent(match[1]!) : null;
}

// Returns null on success (populates req.currentUser), or an error Response on failure.
export async function authenticate(req: AuthenticatedRequest): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  // [why] Cookie fallback lets <img> and other browser-initiated requests
  // authenticate without JS setting an Authorization header.
  const token = headerToken ?? parseCookieToken(req);

  if (!token) return unauthorized('Missing Bearer token');

  // [why] hf_ prefix identifies API tokens; everything else is treated as a JWT.
  if (token.startsWith('hf_')) return authenticateApiToken(req, token);

  const decoded = await verifyAccessToken({ token });
  if (!decoded) return unauthorized('Invalid or expired access token');

  req.currentUser = { id: decoded.sub, email: decoded.email };
  return null;
}
