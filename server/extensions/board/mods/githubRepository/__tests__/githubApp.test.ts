import { beforeEach, describe, expect, it } from 'bun:test';
import type { GithubProjectReference } from '../../githubProjectUrl';

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC2NOT8Xg5DzArt
D1NfpXntAtgTXXSDz9JJ++0yVvw0wRdGJSPEeYgGyY+K+M6+ujExOyWuFos4gD2F
Md3VVwZXFYQMPXrOVDSBOKHbB9XIfx16mT55PCMaAcspYnxRO+m97HkrzwfxTOd7
M+CjYawq2WNVN8zTfeOb5HmTbRGu7YV/JazD/2O94IP3IWxNsI8lP0zXdXOaNSaQ
QNA5hW3ypFDlZz1fIRvdR5pW8VA4XkuFuEQlKO/U/Fhm7eNRxFOylREcv2xeYqF6
S67Z7wbptuV9U6qqIyNBZ9Ro60TeFgwmEwORy0fL/Re5x1Sn2sRomVN4gPUstzh1
1ZX5ue2RAgMBAAECggEAGZxQNl/TEfj/bShLEAXeoC+W5wvrCW7/8CnCwqFi5Fhi
uNeWEjMB6XBR5pcH2lup9/FIH9Ln4Tp3Sz5B38+SYtGxpJXMqe1AjwxChdqxVDP3
1QhutVQ8W9a2M3w2HKX2+hzfwEZip6pnXBQj5lsfe8tgELWd6vlGMZ6Y7x20z1kz
PWqDPQC9rUtQS0Vq9HwhVpzlNMqHUPLVt7GIlmMxZdTZXcaBu2k3uGVaFfh00AHB
6IlNUfq8DympMTEP9oW87ApSj5awMaFBtlXwbZTubICZamQtb8kWhZqPcG+BAsqn
LaHodRhnmsnUV7Uo7X1YBlOryqcStzWv5NsnICZ2pQKBgQDed7Hid0ieHnmJbNWj
6LeMdn+sELgi17YL3MCuYqAPP3CjTzj2hD9eCdf899D3EKqO+iFRiP4UlLy5G/C+
JWEL+TMQ5CsQ3qZ0vnehxMg8O0Jvjc6pySvtcjqVlDyPfqdSYWCoKLMO8oD8+cwx
+WZNY/UgT+2ZO6LQFyBn+TMoxQKBgQDRq6jveeGV17vrDTKee2IpPgQ2mqg4LDNl
6mabDODcI51qcOyPCxmRtIfls5g+L3JgGUDXr+BZSoZhkTHYhINdr1RokDJDPioe
ZCURN0S1SNhM+PkDWmjtfio1RyO8dUc//S2+q+ZsNxCCcxIJwY90xPCe5MU0imrB
06DfSmmGXQKBgBbPry3JjWipN00gG8fy1N9SR0UdccQg2kndGOTIuCDYIHSeavjc
FqNN3xfRUVwEGXkPrNrvcR4rIi7Y7paQvqK7qsDQpJnWOrs9zIaJ5v5GFUnbAJXo
StjOHbO4v3z3P7DyyzZy9elSdGd8NbPqHtNQrJHjoDlWJBuyQ2Bl7RkBAoGBAJGi
S1Azd0ZON7+3Rg6govkEk4ad+/Qwd2711lkiI9mkf0WctCNTUWpMXAxnp3qiGC65
u7lU917uDdMdN+Mtf9WF3/pVFiRwvG6pnrmLixTkSSGF2ejDVpiHhqfFBwRy7Y97
utdyrTVDNht18/SE1rEDziJ/wp6Q+kAxT89o700dAoGAMYJk4lP1RNLQOI4C9gR7
D6qFShCER6GC3R6B5uVwHJJIV+LAqyVmO6Z91tio7KyC8JfHRmoTpEfwHvvydiRl
M0VGeVBgMIBqSiYkJh4WJ2/JEHhxJ3MsYeICHnaJC/xtKYsBrAA1XlAnlHC3oslQ
ILGSHKmmvSwNhBR0l5c6Mgw=
-----END PRIVATE KEY-----`;

const module = await import('../githubApp');
const {
  getGithubInstallationAccessToken,
  getGithubRepositoryDefaultBranch,
  boardGithubAppDeps,
} = module;

let nowMs = Date.parse('2026-06-03T12:00:00.000Z');
let tokenCounter = 0;
let requests: Array<{ url: string; auth: string }>;

function makeReference({
  owner,
  repository,
}: {
  owner: string;
  repository: string;
}): GithubProjectReference {
  return {
    scope: 'repo',
    owner,
    repository,
    projectNumber: 1,
  };
}

beforeEach(() => {
  nowMs = Date.parse('2026-06-03T12:00:00.000Z');
  tokenCounter = 0;
  requests = [];

  (boardGithubAppDeps.config as {
    appId: string;
    appPrivateKey: string;
    githubApiBaseUrl: string;
    installationTokenRefreshSkewMs: number;
  }).appId = '12345';
  (boardGithubAppDeps.config as {
    appId: string;
    appPrivateKey: string;
    githubApiBaseUrl: string;
    installationTokenRefreshSkewMs: number;
  }).appPrivateKey = TEST_PRIVATE_KEY;
  (boardGithubAppDeps.config as {
    appId: string;
    appPrivateKey: string;
    githubApiBaseUrl: string;
    installationTokenRefreshSkewMs: number;
  }).githubApiBaseUrl = 'https://api.github.test';
  (boardGithubAppDeps.config as {
    appId: string;
    appPrivateKey: string;
    githubApiBaseUrl: string;
    installationTokenRefreshSkewMs: number;
  }).installationTokenRefreshSkewMs = 60_000;

  boardGithubAppDeps.now = () => new Date(nowMs);
  boardGithubAppDeps.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
    requests.push({ url, auth: authHeader });

    if (url.includes('/installation') && init?.method !== 'POST') {
      const id = [...url].reduce((acc, char) => acc + char.charCodeAt(0), 7000);
      return Response.json({ id });
    }

    if (url.includes('/app/installations/') && url.endsWith('/access_tokens')) {
      tokenCounter += 1;
      return Response.json({
        token: `ghs_token_${String(tokenCounter)}`,
        expires_at: new Date(nowMs + 60 * 60 * 1000).toISOString(),
      });
    }

    if (url.includes('/repos/') && !url.endsWith('/installation')) {
      return Response.json({ default_branch: 'main' });
    }

    return Response.json({ message: 'not found' }, { status: 404 });
  };
});

describe('githubApp', () => {
  it('mints installation access token and reuses it within validity window', async () => {
    const reference = makeReference({
      owner: 'octo-install-1',
      repository: 'repo-install-1',
    });

    const first = await getGithubInstallationAccessToken({ reference });
    const second = await getGithubInstallationAccessToken({ reference });

    expect(first).toBe('ghs_token_1');
    expect(second).toBe('ghs_token_1');
    expect(tokenCounter).toBe(1);
    expect(requests.length).toBe(2);
    expect(requests[0]?.url).toContain('/repos/octo-install-1/repo-install-1/installation');
    expect(requests[1]?.url).toContain('/app/installations/');
  });

  it('refreshes installation token when cached token nears expiry skew', async () => {
    const reference = makeReference({
      owner: 'octo-install-2',
      repository: 'repo-install-2',
    });

    const first = await getGithubInstallationAccessToken({ reference });
    nowMs += 59 * 60 * 1000 + 5 * 1000;
    const second = await getGithubInstallationAccessToken({ reference });

    expect(first).toBe('ghs_token_1');
    expect(second).toBe('ghs_token_2');
    expect(tokenCounter).toBe(2);
  });

  it('uses installation token to read repository default branch', async () => {
    const branch = await getGithubRepositoryDefaultBranch({
      owner: 'octo-org',
      repository: 'octo-repo',
      token: 'ghs_inline_token',
    });

    expect(branch).toBe('main');
    const repoRequest = requests.find((request) => request.url.endsWith('/repos/octo-org/octo-repo'));
    expect(repoRequest?.auth).toBe('Bearer ghs_inline_token');
  });

  it('fails fast when GitHub App credentials are not configured', async () => {
    (boardGithubAppDeps.config as { appPrivateKey: string }).appPrivateKey = '';

    await expect(getGithubInstallationAccessToken({
      reference: makeReference({
        owner: 'octo-install-3',
        repository: 'repo-install-3',
      }),
    })).rejects.toThrow('github-app-not-configured');
  });
});
