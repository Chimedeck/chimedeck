// OAuth provider credentials loaded from env.
import { env } from '../../../../config/env';

export const oauthConfig = {
  google: {
    clientId: env.OAUTH_GOOGLE_CLIENT_ID,
    clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.APP_URL}/api/v1/auth/oauth/google/callback`,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    clientId: env.OAUTH_GITHUB_CLIENT_ID,
    clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
    redirectUri: `${env.APP_URL}/api/v1/auth/oauth/github/callback`,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userApiUrl: 'https://api.github.com/user',
    userEmailsUrl: 'https://api.github.com/user/emails',
    scopes: ['read:user', 'user:email'],
  },
  stateTtlSeconds: 10 * 60, // 10 minutes
} as const;

export type OAuthProvider = 'google' | 'github';
