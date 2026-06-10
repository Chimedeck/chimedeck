// Path allowlist validator — ensures search paths are within approved boundaries.
// [why] Prevents exfiltration of sensitive files (env, credentials, private data)
// by rejecting any search request that targets out-of-scope paths.

import { PATH_ALLOWLIST } from '../../common/config';

/**
 * Validate that every requested focus path matches at least one allowlist pattern.
 * Returns null on success, or an error result with status 403.
 */
export function validatePathAllowlist({
  focusPaths,
}: {
  focusPaths?: string[];
}): { name: string; status: number; message?: string } | null {
  if (!focusPaths || focusPaths.length === 0) return null;

  for (const requested of focusPaths) {
    const allowed = PATH_ALLOWLIST.some(pattern => {
      // [why] Simple prefix match — a requested path "specs/architecture/"
      // matches the allowlist entry "specs/architecture/".
      if (pattern.endsWith('**') || pattern.endsWith('*')) {
        const prefix = pattern.replace(/\*\*\/?\*?$/, '');
        return requested.startsWith(prefix) || requested === prefix;
      }
      if (pattern.endsWith('/')) {
        return requested.startsWith(pattern);
      }
      // [why] Glob patterns without trailing / — match prefix plus potential glob.
      const globPrefix = pattern.split('*')[0];
      return requested.startsWith(globPrefix);
    });

    if (!allowed) {
      return {
        name: 'path-not-allowed',
        status: 403,
        message: `Path "${requested}" is not in the allowlist`,
      };
    }
  }

  return null;
}

export const pathAllowlistDeps = {
  validatePathAllowlist,
};
