import { createHash } from 'crypto';

export type GithubProjectScope = 'org' | 'user' | 'repo';

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

function parseReference(segments: string[]): GithubProjectReference | null {
  const projectNumber = toProjectNumber(segments[3] ?? '');
  if (projectNumber === null) return null;

  if (segments.length === 4 && segments[0] === 'orgs' && segments[2] === 'projects') {
    return {
      scope: 'org',
      owner: segments[1]!,
      repository: null,
      projectNumber,
    };
  }

  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'projects') {
    return {
      scope: 'user',
      owner: segments[1]!,
      repository: null,
      projectNumber,
    };
  }

  if (segments.length === 4 && segments[2] === 'projects') {
    return {
      scope: 'repo',
      owner: segments[0]!,
      repository: segments[1]!,
      projectNumber,
    };
  }

  return null;
}

function toNormalizedPath(reference: GithubProjectReference): string {
  if (reference.scope === 'org') {
    return `orgs/${reference.owner}/projects/${String(reference.projectNumber)}`;
  }
  if (reference.scope === 'user') {
    return `users/${reference.owner}/projects/${String(reference.projectNumber)}`;
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
      message: 'github_project_url must point to a GitHub project URL',
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
