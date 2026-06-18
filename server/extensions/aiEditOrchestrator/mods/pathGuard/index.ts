// Path guard — validates that file paths are within allowed write zones.
// [why] Prevents the AI orchestrator from writing outside the allowed
// specs directories, protecting sensitive files like .env, code, or config.
import { ALLOWED_PATHS } from '../../common/config';
import type { PathGuardResult } from '../../types';

/** Directories that are explicitly disallowed — path traversal attempts. */
const DISALLOWED_PREFIXES = [
  '..',
  '/etc/',
  '/tmp/',
  '/var/',
  '.git/',
  'node_modules/',
  '.env',
] as const;

/**
 * Normalise a file path — resolve `.` and `..` segments, strip leading slashes,
 * and ensure the path is relative.
 */
function normalisePath(filePath: string): string {
  // Strip leading slashes and trailing slashes
  const normalised = filePath.replace(/^\/+/, '').replace(/\/+$/, '');

  // Resolve `..` segments — reject any that escape root
  const segments = normalised.split('/');
  const resolved: string[] = [];
  for (const seg of segments) {
    if (seg === '..') {
      if (resolved.length === 0) {
        // Attempted to escape root
        return `__ESCAPED__${normalised}`;
      }
      resolved.pop();
    } else if (seg !== '.' && seg !== '') {
      resolved.push(seg);
    }
  }
  return resolved.join('/');
}

/**
 * Check whether a normalised path falls within the allowed directories.
 */
function isAllowedPath(normalised: string): boolean {
  return ALLOWED_PATHS.some(
    (allowed) => normalised.startsWith(allowed) || normalised === allowed.replace(/\/+$/, '')
  );
}

/**
 * Check for disallowed prefixes (path traversal, system paths).
 */
function isDisallowedPath(normalised: string): boolean {
  return DISALLOWED_PREFIXES.some(
    (prefix) => normalised.startsWith(prefix) || normalised.includes(prefix)
  );
}

export const pathGuardDeps = {
  normalisePath,
  isAllowedPath,
  isDisallowedPath,
};

/**
 * Validate a file path against the allowed write zones.
 * Returns whether the path is allowed, the normalised path, and a reason
 * if rejected.
 */
export function validatePath({ filePath }: { filePath: string }): PathGuardResult {
  if (!filePath || filePath.trim() === '') {
    return { allowed: false, normalisedPath: '', reason: 'Empty file path' };
  }

  const normalised = normalisePath(filePath.trim());

  // Check for escape attempts
  if (normalised.startsWith('__ESCAPED__')) {
    return {
      allowed: false,
      normalisedPath: filePath,
      reason: 'Path traversal attempt — path escapes allowed root',
    };
  }

  // Check for disallowed paths
  if (isDisallowedPath(normalised)) {
    return {
      allowed: false,
      normalisedPath: normalised,
      reason: `Path contains disallowed prefix: ${normalised}`,
    };
  }

  // Check against allowed paths
  if (!isAllowedPath(normalised)) {
    return {
      allowed: false,
      normalisedPath: normalised,
      reason: `Path "${normalised}" is outside allowed write zones: [${ALLOWED_PATHS.join(', ')}]`,
    };
  }

  return { allowed: true, normalisedPath: normalised };
}
