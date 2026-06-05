// githubProjectUrl — client-side mirror of the server-side URL normaliser.
//
// Lives at `src/extensions/Board/mods/githubProjectUrl.ts` so the regex /
// parsing rules are testable in isolation and so the React component can
// stay focused on rendering.  The shapes accepted here MUST stay in sync
// with `server/extensions/board/mods/githubProjectUrl.ts` (which is the
// authoritative normaliser that runs on save).
//
// Accepted input shapes:
//   1. Project URL — https://github.com/(orgs|users)/<owner>/projects/<n>
//                    https://github.com/<owner>/<repo>/projects/<n>
//   2. HTTPS repo URL — https://github.com/<owner>/<repo>(.git)?
//   3. SSH clone URL — git@github.com:<owner>/<repo>(.git)?

export type GithubProjectScope = 'org' | 'user' | 'repo' | 'repo-https' | 'repo-ssh';

export interface GithubProjectReference {
  scope: GithubProjectScope;
  owner: string;
  repository: string | null;
  projectNumber: number;
}

// ── Regex fragments ────────────────────────────────────────────────────────
// [why] GitHub allows '-' and '.' (and '_' on the username side) in owner /
// repo slugs.  Project numbers only use [a-zA-Z0-9-] so we keep the narrower
// set there.
const REPO_NAME_REGEX = /^[A-Za-z0-9._-]+$/;
const REPO_OWNER_REGEX = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function isValidRepoName(value: string): boolean {
  // GitHub: cannot start/end with '.', cannot be '..' or '.git'.
  if (!value || value === '..' || value === '.git' || value.startsWith('.') || value.endsWith('.')) {
    return false;
  }
  return REPO_NAME_REGEX.test(value);
}

function isValidOwnerName(value: string): boolean {
  return REPO_OWNER_REGEX.test(value);
}

function toProjectNumber(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// [why] SSH clone URLs are not valid `URL()` inputs, so they get a dedicated
// parser.  Accepts: git@github.com:owner/repo(.git)?
const SSH_REPO_REGEX =
  /^git@github\.com:([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]+?)(?:\.git)?$/;

function parseSshCloneUrl(value: string): GithubProjectReference | null {
  const match = SSH_REPO_REGEX.exec(value.trim());
  // [why] `RegExp.exec` returns `RegExpExecArray | null`; in the strict TS
  // config the indexer returns `string | undefined`, so we narrow first
  // instead of using non-null assertions.
  const owner = match?.[1];
  const repository = match?.[2];
  if (owner === undefined || repository === undefined) return null;
  if (!isValidRepoName(repository)) return null;
  return {
    scope: 'repo-ssh',
    owner,
    repository,
    projectNumber: 0,
  };
}

// ── Project-URL parsers (one per scope) ────────────────────────────────────
// [why] Splitting the project-URL shapes into separate helpers keeps each
// function's cognitive complexity under the lint cap.  All three share the
// same 4-segment shape (`<bucket>/<owner>/projects/<n>`) but differ in how
// they validate the owner/repo pair.

function parseOrgProjectUrl(segments: string[], projectNumber: number): GithubProjectReference | null {
  const owner = segments[1] ?? '';
  if (!isValidOwnerName(owner)) return null;
  return { scope: 'org', owner, repository: null, projectNumber };
}

function parseUserProjectUrl(segments: string[], projectNumber: number): GithubProjectReference | null {
  const owner = segments[1] ?? '';
  if (!isValidOwnerName(owner)) return null;
  return { scope: 'user', owner, repository: null, projectNumber };
}

function parseRepoProjectUrl(segments: string[], projectNumber: number): GithubProjectReference | null {
  const owner = segments[0] ?? '';
  const repository = segments[1] ?? '';
  if (!isValidOwnerName(owner) || !isValidRepoName(repository)) return null;
  return { scope: 'repo', owner, repository, projectNumber };
}

function parseRepoCloneUrl(segments: string[]): GithubProjectReference | null {
  if (segments.length !== 2) return null;
  const [owner, repository] = segments;
  if (!owner || !repository) return null;
  // Strip optional `.git` suffix used by clone URLs.
  const bareName = repository.endsWith('.git') ? repository.slice(0, -'.git'.length) : repository;
  if (!isValidOwnerName(owner) || !isValidRepoName(bareName)) return null;
  return { scope: 'repo-https', owner, repository: bareName, projectNumber: 0 };
}

function parseHttpsReference(segments: string[]): GithubProjectReference | null {
  const projectNumber = toProjectNumber(segments[3] ?? '');

  // ── Existing project-URL shapes (`<bucket>/<owner>/projects/<n>`) ─────
  if (projectNumber !== null && segments.length === 4 && segments[2] === 'projects') {
    switch (segments[0]) {
      case 'orgs':
        return parseOrgProjectUrl(segments, projectNumber);
      case 'users':
        return parseUserProjectUrl(segments, projectNumber);
      default:
        return parseRepoProjectUrl(segments, projectNumber);
    }
  }

  // ── Plain repository URLs (no /projects/N) ─────────────────────────────
  return parseRepoCloneUrl(segments);
}

function toCanonicalPath(reference: GithubProjectReference): string {
  if (reference.scope === 'org') {
    return `orgs/${reference.owner}/projects/${String(reference.projectNumber)}`;
  }
  if (reference.scope === 'user') {
    return `users/${reference.owner}/projects/${String(reference.projectNumber)}`;
  }
  if (reference.scope === 'repo-https' || reference.scope === 'repo-ssh') {
    // [why] We always persist the canonical HTTPS form so subsequent lookups
    // (audit hashes, downstream consumers) stay stable regardless of whether
    // the user pasted an SSH or HTTPS clone URL.
    return `${reference.owner}/${reference.repository ?? ''}`;
  }
  return `${reference.owner}/${reference.repository ?? ''}/projects/${String(reference.projectNumber)}`;
}

/**
 * Parse a user-supplied GitHub URL into a structured reference.  Returns
 * `null` when the input doesn't match any supported shape — callers should
 * surface the validation error to the user.
 *
 * The function is intentionally permissive about leading/trailing whitespace
 * and a single trailing slash (mirrors the server behaviour).
 */
export function parseGithubProjectUrl(value: string): GithubProjectReference | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // SSH clone URLs (git@github.com:owner/repo(.git)?) — not parseable by `new URL`.
  if (trimmed.startsWith('git@')) {
    return parseSshCloneUrl(trimmed);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname.toLowerCase() !== 'github.com') return null;
  if (parsed.port || parsed.username || parsed.password) return null;

  const segments = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  return parseHttpsReference(segments);
}

/**
 * Normalise a user-supplied URL to the canonical HTTPS form the server
 * persists.  Returns `null` for invalid input so the caller can decide
 * whether to surface an error or treat the field as empty.
 */
export function normalizeGithubProjectUrl(value: string): string | null {
  const reference = parseGithubProjectUrl(value);
  if (!reference) return null;
  return `https://github.com/${toCanonicalPath(reference)}`;
}
