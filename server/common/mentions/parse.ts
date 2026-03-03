// Extracts @mention nicknames from plain text.
// Returns an array of unique nickname strings (without the leading @).
const MENTION_REGEX = /\B@([\w-]{1,50})/g;

export function extractMentions({ text }: { text: string }): string[] {
  const matches = [...text.matchAll(MENTION_REGEX)];
  const nicknames = matches.map((m) => m[1] as string);
  // Deduplicate while preserving order
  return [...new Set(nicknames)];
}
