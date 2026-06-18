// Secret redactor — scans context chunks for secret-like values before emitting.
// [why] Search results may accidentally contain API keys, tokens, passwords,
// or other credentials. Redacting them prevents leaks to callers and logs.

import type { ContextChunk } from '../../types';

// [why] Common patterns that indicate credentials.
// Each pattern is tested against content and replaced if matched.
// [why] Order matters: more specific patterns (JWT) must run before generic
// patterns (long alphanumeric strings) to avoid incorrect matches.
const SECRET_PATTERNS: { pattern: RegExp; replacement: string; label: string }[] = [
  // JWT tokens (header.payload.signature) — test BEFORE generic key pattern
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: '[REDACTED_JWT]',
    label: 'jwt',
  },
  // Bearer tokens — test before generic key pattern
  {
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
    label: 'bearer-token',
  },
  // API keys (various formats) — must run AFTER JWT to avoid false matches
  { pattern: /\b[A-Za-z0-9_]{20,60}\b/g, replacement: '[REDACTED_API_KEY]', label: 'api-key' },
  // Password assignments
  {
    pattern: /(password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*[\S]+\s*/gi,
    replacement: '$1: [REDACTED] ',
    label: 'password-assignment',
  },
  // Connection strings
  {
    pattern: /\b(mongodb|postgres|mysql|redis|sqlite):\/\/[^\s]+/gi,
    replacement: '[REDACTED_CONNECTION_STRING]',
    label: 'connection-string',
  },
];

/**
 * Scan a single chunk for secret-like patterns and redact matches.
 * Returns a new chunk with redacted content.
 */
function redactChunk(chunk: ContextChunk): ContextChunk {
  let content = chunk.content;
  let redacted = false;

  for (const { pattern, replacement } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      content = content.replaceAll(pattern, replacement);
      redacted = true;
    }
  }

  return redacted ? { ...chunk, content } : chunk;
}

/**
 * Redact secrets from all context chunks.
 */
export function redactSecrets(chunks: ContextChunk[]): ContextChunk[] {
  return chunks.map(redactChunk);
}

export const secretRedactorDeps = {
  redactSecrets,
};
