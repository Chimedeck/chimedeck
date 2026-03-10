// GET /api/v1/auth/oauth/:provider — redirect to OAuth consent screen.
import { randomBytes } from 'crypto';
import { oauthConfig, type OAuthProvider } from '../../common/config/oauth';
import { memCache } from '../../../../mods/cache';
import { flags } from '../../../../mods/flags';

const SUPPORTED_PROVIDERS: OAuthProvider[] = ['google', 'github'];
const FLAG_MAP: Record<OAuthProvider, string> = {
  google: 'OAUTH_GOOGLE_ENABLED',
  github: 'OAUTH_GITHUB_ENABLED',
};

export async function handleOAuthRedirect(req: Request, provider: OAuthProvider): Promise<Response> {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return Response.json(
      { error: { code: 'not-found', message: `Unknown OAuth provider: ${provider}` } },
      { status: 404 },
    );
  }

  const isEnabled = await flags.isEnabled(FLAG_MAP[provider]);
  if (!isEnabled) {
    return Response.json(
      { error: { code: 'oauth-provider-disabled', message: `${provider} OAuth is disabled` } },
      { status: 403 },
    );
  }

  const state = randomBytes(16).toString('hex');
  // Store state nonce in cache with 10-minute TTL to prevent CSRF.
  memCache.set(`oauth_state:${state}`, provider, oauthConfig.stateTtlSeconds);

  const config = oauthConfig[provider];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  return Response.redirect(`${config.authUrl}?${params.toString()}`, 302);
}
