// Exchanges a GitHub OAuth authorisation code for a user profile.
import { oauthConfig } from '../../common/config/oauth';

interface GitHubProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface ExchangeResult {
  status: 200 | 502;
  profile?: GitHubProfile;
  name?: string;
}

export async function exchangeGitHubCode({
  code,
}: {
  code: string;
}): Promise<ExchangeResult> {
  // Exchange code for access token.
  const tokenRes = await fetch(oauthConfig.github.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: oauthConfig.github.clientId,
      client_secret: oauthConfig.github.clientSecret,
      redirect_uri: oauthConfig.github.redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokens.access_token || tokens.error) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  // Fetch user profile.
  const userRes = await fetch(oauthConfig.github.userApiUrl, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'User-Agent': 'kanban-app',
    },
  });

  if (!userRes.ok) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  const user = (await userRes.json()) as {
    id?: number;
    login?: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string;
  };

  // GitHub may not expose email publicly; fetch from the emails endpoint.
  let email = user.email;
  if (!email) {
    const emailsRes = await fetch(oauthConfig.github.userEmailsUrl, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'User-Agent': 'kanban-app',
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? null;
    }
  }

  if (!user.id || !email) {
    return { status: 502, name: 'oauth-provider-error' };
  }

  const profile: GitHubProfile = {
    id: `github:${user.id}`,
    email,
    name: user.name ?? user.login ?? email,
  };
  if (user.avatar_url) profile.picture = user.avatar_url;

  return {
    status: 200,
    profile,
  };
}
