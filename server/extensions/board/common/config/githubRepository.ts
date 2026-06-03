import { resolve } from 'node:path';
import { env } from '../../../../config/env';

const DEFAULT_REPOSITORY_CACHE_DIR = resolve(process.cwd(), '.cache', 'github-repositories');

export const githubRepositoryConfig = {
  appId: env.GITHUB_APP_ID,
  appPrivateKey: env.GITHUB_APP_PRIVATE_KEY,
  appBotAlias: env.GITHUB_APP_BOT_ALIAS,
  githubApiBaseUrl: env.GITHUB_APP_API_BASE_URL,
  repositoryCacheDir: env.GITHUB_REPOSITORY_CACHE_DIR
    ? resolve(env.GITHUB_REPOSITORY_CACHE_DIR)
    : DEFAULT_REPOSITORY_CACHE_DIR,
  repositoryCacheTtlMs: Math.max(0, env.GITHUB_REPOSITORY_CACHE_TTL_SECONDS) * 1000,
  installationTokenRefreshSkewMs: Math.max(0, env.GITHUB_INSTALLATION_TOKEN_REFRESH_SKEW_SECONDS) * 1000,
} as const;
