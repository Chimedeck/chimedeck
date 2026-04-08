// GET /api/v1/auth/oauth/:provider/callback — exchange code, upsert user, issue tokens.
import { randomBytes } from 'crypto';
import { generateId } from '../../../../common/uuid';
import { db } from '../../../../common/db';
import { memCache } from '../../../../mods/cache';
import { exchangeGoogleCode } from '../../mods/oauth/google';
import { exchangeGitHubCode } from '../../mods/oauth/github';
import { issueAccessToken } from '../../mods/token/issue';
import { jwtConfig } from '../../common/config/jwt';
import { type OAuthProvider } from '../../common/config/oauth';
import { env } from '../../../../config/env';

export async function handleOAuthCallback(
  req: Request,
  provider: OAuthProvider,
): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.json(
      { error: { code: 'oauth-provider-error', message: error } },
      { status: 502 },
    );
  }

  if (!code || !state) {
    return Response.json(
      { error: { code: 'oauth-state-mismatch', message: 'Missing code or state' } },
      { status: 400 },
    );
  }

  // Validate CSRF state nonce.
  const storedProvider = memCache.get(`oauth_state:${state}`);
  if (storedProvider !== provider) {
    return Response.json(
      { error: { code: 'oauth-state-mismatch', message: 'Invalid OAuth state' } },
      { status: 400 },
    );
  }
  memCache.del(`oauth_state:${state}`);

  // Exchange code for profile.
  let profileResult: { status: number; profile?: { id: string; email: string; name: string; picture?: string }; name?: string };
  if (provider === 'google') {
    profileResult = await exchangeGoogleCode({ code });
  } else {
    profileResult = await exchangeGitHubCode({ code });
  }

  if (profileResult.status !== 200 || !profileResult.profile) {
    return Response.json(
      { error: { code: 'oauth-provider-error', message: 'Failed to get user profile from provider' } },
      { status: 502 },
    );
  }

  const profile = profileResult.profile;

  // Upsert user by email (provider id used as avatar fallback id).
  let user = await db('users').where({ email: profile.email }).first();
  if (!user) {
    const newUser = {
      id: generateId(),
      email: profile.email,
      name: profile.name,
      avatar_url: profile.picture ?? null,
      created_at: new Date(),
    };
    await db('users').insert(newUser);
    user = newUser;
  }

  const accessToken = await issueAccessToken({ sub: user.id, email: user.email });

  const refreshToken = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + jwtConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: generateId(),
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
    created_at: now,
  });

  const responseHeaders = new Headers();
  responseHeaders.append(
    'Set-Cookie',
    `refresh_token=${refreshToken}; HttpOnly; Path=/api/v1/auth/refresh; SameSite=Strict; Secure; Max-Age=${jwtConfig.refreshTokenTtlDays * 86400}`,
  );
  // [why] access_token cookie lets <img> tags and other browser resource
  // requests authenticate without an Authorization header.
  responseHeaders.append(
    'Set-Cookie',
    `access_token=${accessToken}; HttpOnly; Path=/; SameSite=Strict; Secure; Max-Age=${jwtConfig.accessTokenTtlSeconds}`,
  );
  // Redirect to frontend with access token in fragment (never in query string).
  responseHeaders.set('Location', `${env.APP_URL}/#access_token=${accessToken}`);

  return new Response(null, { status: 302, headers: responseHeaders });
}
