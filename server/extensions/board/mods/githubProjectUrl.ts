import { createHash } from 'crypto';

export type GithubProjectScope = 'org' | 'user' | 'repo' | 'repo-https' | 'repo-ssh';

export interface GithubProjectReference {
  scope: GithubProjectScope;
  owner: string;
  repository: string | null;
  projectNumber: number;
}

export interface NormalizedGithubProjectUrl {
  normalizedUrl: string;
  hash: string;
  reference: GithubProjectReference;
}

export interface GithubProjectAuditValue {
  hash: string | null;
  reference: GithubProjectReference | null;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toProjectNumber(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// [why] GitHub allows '-' and '.' (and '_' on the username side) in owner/repo slugs.
// Username and project numbers only use [a-zA-Z0-9-] so we keep the narrower set there.
const REPO_NAME_REGEX = /^[A-Za-z0-9._-]+$/;
const REPO_OWNER_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function isValidRepoName(value: string): boolean {
  // GitHub: cannot start/end with '.', cannot be '..' or '.git'
  if (!value || value === '..' || value === '.git' || value.startsWith('.') || value.endsWith('.')) {
    return false;
  }
  return REPO_NAME_REGEX.test(value);
}

function isValidOwnerName(value: string): boolean {
  return REPO_OWNER_REGEX.test(value);
}

function parseReference(segments: string[]): GithubProjectReference | null {
  const projectNumber = toProjectNumber(segments[3] ?? '');

  // ── Existing project-URL shapes ────────────────────────────────────────────
  if (projectNumber !== null) {
    if (segments.length === 4 && segments[0] === 'orgs' && segments[2] === 'projects') {
      if (!isValidOwnerName(segments[1] ?? '')) return null;
      return {
        scope: 'org',
        owner: segments[1]!,
        repository: null,
        projectNumber,
      };
    }

    if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'projects') {
      if (!isValidOwnerName(segments[1] ?? '')) return null;
      return {
        scope: 'user',
        owner: segments[1]!,
        repository: null,
        projectNumber,
      };
    }

    if (segments.length === 4 && segments[2] === 'projects') {
      if (!isValidOwnerName(segments[0] ?? '') || !isValidRepoName(segments[1] ?? '')) return null;
      return {
        scope: 'repo',
        owner: segments[0]!,
        repository: segments[1]!,
        projectNumber,
      };
    }
  }

  // ── Plain repository URLs (no /projects/N) ────────────────────────────────
  if (segments.length === 2) {
    const [owner, repository] = segments;
    if (!owner || !repository) return null;
    // Strip optional `.git` suffix used by clone URLs.
    const bareName = repository.endsWith('.git') ? repository.slice(0, -'.git'.length) : repository;
    if (!isValidOwnerName(owner) || !isValidRepoName(bareName)) return null;
    return {
      scope: 'repo-https',
      owner,
      repository: bareName,
      projectNumber: 0,
    };
  }

  return null;
}

// [why] SSH clone URLs are not valid `URL()` inputs, so they get a dedicated parser.
// Accepts: git@github.com:owner/repo(.git)?
const SSH_REPO_REGEX = /^git@github\.com:([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]+?)(?:\.git)?$/;

function parseSshCloneUrl(value: string): GithubProjectReference | null {
  const match = SSH_REPO_REGEX.exec(value.trim());
  if (!match) return null;
  const owner = match[1]!;
  const repository = match[2]!;
  if (!isValidRepoName(repository)) return null;
  return {
    scope: 'repo-ssh',
    owner,
    repository,
    projectNumber: 0,
  };
}

function toNormalizedPath(reference: GithubProjectReference): string {
  if (reference.scope === 'org') {
    return `orgs/${reference.owner}/projects/${String(reference.projectNumber)}`;
  }
  if (reference.scope === 'user') {
    return `users/${reference.owner}/projects/${String(reference.projectNumber)}`;
  }
  if (reference.scope === 'repo-https' || reference.scope === 'repo-ssh') {
    // [why] We always persist the canonical HTTPS form so subsequent lookups
    // (cache keys, audit hashes, downstream consumers) are stable regardless
    // of whether the user pasted an SSH or HTTPS clone URL.
    return `${reference.owner}/${reference.repository ?? ''}`;
  }
  return `${reference.owner}/${reference.repository ?? ''}/projects/${String(reference.projectNumber)}`;
}

export function normalizeGithubProjectUrl({
  value,
}: {
  value: string;
}):
  | { ok: true; value: NormalizedGithubProjectUrl }
  | { ok: false; message: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'github_project_url must be a non-empty string' };
  }

  // SSH clone URLs (git@github.com:owner/repo(.git)?) — not parseable by `new URL`.
  if (trimmed.startsWith('git@')) {
    const reference = parseSshCloneUrl(trimmed);
    if (!reference) {
      return {
        ok: false,
        message: 'github_project_url must be a valid GitHub project or repository URL',
      };
    }
    const normalizedUrl = `https://github.com/${toNormalizedPath(reference)}`;
    return {
      ok: true,
      value: {
        normalizedUrl,
        hash: hash(normalizedUrl),
        reference,
      },
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: 'github_project_url must be a valid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, message: 'github_project_url must use https' };
  }

  if (parsed.hostname.toLowerCase() !== 'github.com') {
    return { ok: false, message: 'github_project_url must target github.com' };
  }

  if (parsed.port || parsed.username || parsed.password) {
    return { ok: false, message: 'github_project_url cannot include credentials or a custom port' };
  }

  const segments = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const reference = parseReference(segments);
  if (!reference) {
    return {
      ok: false,
      message: 'github_project_url must point to a GitHub project or repository URL',
    };
  }

  const normalizedUrl = `https://github.com/${toNormalizedPath(reference)}`;
  return {
    ok: true,
    value: {
      normalizedUrl,
      hash: hash(normalizedUrl),
      reference,
    },
  };
}

export function toGithubProjectAuditValue({
  url,
}: {
  url: string | null | undefined;
}): GithubProjectAuditValue {
  if (!url) {
    return { hash: null, reference: null };
  }

  const normalized = normalizeGithubProjectUrl({ value: url });
  if (normalized.ok) {
    return {
      hash: normalized.value.hash,
      reference: normalized.value.reference,
    };
  }

  return {
    hash: hash(url.trim()),
    reference: null,
  };
}
