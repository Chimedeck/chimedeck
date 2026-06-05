import { SignJWT, importPKCS8 } from 'jose';
import type { GithubProjectReference } from '../githubProjectUrl';
import { githubRepositoryConfig } from '../../common/config/githubRepository';

interface GithubInstallationResponse {
  id?: unknown;
}

interface GithubInstallationTokenResponse {
  token?: unknown;
  expires_at?: unknown;
}

interface GithubRepositoryResponse {
  default_branch?: unknown;
}

interface InstallationTokenCacheEntry {
  token: string;
  expiresAtMs: number;
}

const installationIdCache = new Map<string, number>();
const installationTokenCache = new Map<number, InstallationTokenCacheEntry>();

function toInstallationKey(reference: GithubProjectReference): string {
  // [why] For all repo-shaped references the App installation is the one for
  // that specific repository. org/user-scoped project URLs still resolve to
  // an org or user installation.
  if (reference.scope === 'repo' || reference.scope === 'repo-https' || reference.scope === 'repo-ssh') {
    return `repo:${reference.owner}/${reference.repository ?? ''}`;
  }
  return `${reference.scope}:${reference.owner}`;
}

function toInstallationPath(reference: GithubProjectReference): string {
  const owner = encodeURIComponent(reference.owner);
  if (reference.scope === 'repo' || reference.scope === 'repo-https' || reference.scope === 'repo-ssh') {
    const repository = encodeURIComponent(reference.repository ?? '');
    return `/repos/${owner}/${repository}/installation`;
  }
  if (reference.scope === 'org') {
    return `/orgs/${owner}/installation`;
  }
  return `/users/${owner}/installation`;
}

function toEpochMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getRequiredGithubAppConfig() {
  if (!boardGithubAppDeps.config.appId || !boardGithubAppDeps.config.appPrivateKey) {
    throw new Error('github-app-not-configured');
  }
  return boardGithubAppDeps.config;
}

async function createGithubAppJwt(): Promise<string> {
  const config = getRequiredGithubAppConfig();
  const nowEpochSeconds = Math.floor(boardGithubAppDeps.now().getTime() / 1000);
  const privateKey = await importPKCS8(config.appPrivateKey, 'RS256');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(nowEpochSeconds - 30)
    .setExpirationTime(nowEpochSeconds + 9 * 60)
    .setIssuer(config.appId)
    .sign(privateKey);
}

async function requestGithub({
  path,
  method = 'GET',
  bearerToken,
}: {
  path: string;
  method?: 'GET' | 'POST';
  bearerToken: string;
}): Promise<Response> {
  const baseUrl = boardGithubAppDeps.config.githubApiBaseUrl.endsWith('/')
    ? boardGithubAppDeps.config.githubApiBaseUrl
    : `${boardGithubAppDeps.config.githubApiBaseUrl}/`;
  const targetUrl = new URL(path.replace(/^\//, ''), baseUrl).toString();
  return boardGithubAppDeps.fetch(targetUrl, {
    method,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

async function resolveInstallationId({
  reference,
  appJwt,
}: {
  reference: GithubProjectReference;
  appJwt: string;
}): Promise<number> {
  const cacheKey = toInstallationKey(reference);
  const cached = installationIdCache.get(cacheKey);
  if (typeof cached === 'number') return cached;

  const response = await requestGithub({
    path: toInstallationPath(reference),
    bearerToken: appJwt,
  });
  if (!response.ok) {
    throw new Error('github-installation-lookup-failed');
  }

  const payload = (await readJson(response)) as GithubInstallationResponse | null;
  const installationId = typeof payload?.id === 'number'
    ? payload.id
    : null;
  if (installationId === null) {
    throw new Error('github-installation-lookup-failed');
  }
  installationIdCache.set(cacheKey, installationId);
  return installationId;
}

function getCachedInstallationToken(installationId: number): string | null {
  const cached = installationTokenCache.get(installationId);
  if (!cached) return null;
  const nowMs = boardGithubAppDeps.now().getTime();
  if (cached.expiresAtMs <= nowMs + boardGithubAppDeps.config.installationTokenRefreshSkewMs) {
    installationTokenCache.delete(installationId);
    return null;
  }
  return cached.token;
}

export const boardGithubAppDeps = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  now: () => new Date(),
  config: githubRepositoryConfig,
};

export async function getGithubInstallationAccessToken({
  reference,
}: {
  reference: GithubProjectReference;
}): Promise<string> {
  const appJwt = await createGithubAppJwt();
  const installationId = await resolveInstallationId({ reference, appJwt });
  const cachedToken = getCachedInstallationToken(installationId);
  if (cachedToken) return cachedToken;

  const response = await requestGithub({
    path: `/app/installations/${String(installationId)}/access_tokens`,
    method: 'POST',
    bearerToken: appJwt,
  });
  if (!response.ok) {
    throw new Error('github-installation-token-create-failed');
  }

  const payload = (await readJson(response)) as GithubInstallationTokenResponse | null;
  if (typeof payload?.token !== 'string' || typeof payload.expires_at !== 'string') {
    throw new Error('github-installation-token-create-failed');
  }

  const expiresAtMs = toEpochMs(payload.expires_at);
  if (expiresAtMs === null) {
    throw new Error('github-installation-token-create-failed');
  }

  installationTokenCache.set(installationId, {
    token: payload.token,
    expiresAtMs,
  });
  return payload.token;
}

export async function getGithubRepositoryDefaultBranch({
  owner,
  repository,
  token,
}: {
  owner: string;
  repository: string;
  token: string;
}): Promise<string> {
  const response = await requestGithub({
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`,
    bearerToken: token,
  });
  if (!response.ok) {
    throw new Error('github-repository-read-failed');
  }

  const payload = (await readJson(response)) as GithubRepositoryResponse | null;
  const branch = typeof payload?.default_branch === 'string'
    ? payload.default_branch.trim()
    : '';
  if (!branch) {
    throw new Error('github-repository-read-failed');
  }
  return branch;
}
