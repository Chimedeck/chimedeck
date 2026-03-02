// Exchanges a Google OAuth authorisation code for a user profile.
import { oauthConfig } from '../../common/config/oauth';

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface ExchangeResult {
  status: 200 | 502;
  profile?: GoogleProfile;
  name?: string;
}

export async function exchangeGoogleCode({
  code,
}: {
  code: string;
}): Promise<ExchangeResult> {
  // Exchange code for tokens.
  const tokenRes = await fetch(oauthConfig.google.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: oauthConfig.google.clientId,
      client_secret: oauthConfig.google.clientSecret,
      redirect_uri: oauthConfig.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  // Fetch user profile.
  const userRes = await fetch(oauthConfig.google.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  const user = (await userRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  if (!user.sub || !user.email) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  const profile: GoogleProfile = {
    id: `google:${user.sub}`,
    email: user.email,
    name: user.name ?? user.email,
  };
  if (user.picture) profile.picture = user.picture;

  return {
    status: 200,
    profile,
  };
}
