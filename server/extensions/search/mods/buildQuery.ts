// server/extensions/search/mods/buildQuery.ts
// Sanitizes user input and constructs a PostgreSQL tsquery string.
// WHY: raw user input can contain tsquery operators (&, |, !, :, (, ), ')
// that would cause a parse error; we strip them before building the query.

const TSQUERY_SPECIAL = /[&|!():*'\\]/g;

/**
 * Converts a free-text user query into a prefix-match tsquery string.
 * Each word becomes a prefix term joined with AND (e.g. "foo bar" → "foo:* & bar:*").
 * Returns null when no usable terms remain after sanitization.
 */
export function buildQuery({ q }: { q: string }): string | null {
  const sanitized = q.replace(TSQUERY_SPECIAL, ' ');
  const terms = sanitized.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return null;
  // Prefix-match each term so partial words match
  return terms.map((t) => `${t}:*`).join(' & ');
}
