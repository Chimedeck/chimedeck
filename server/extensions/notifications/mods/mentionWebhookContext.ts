// server/extensions/notifications/mods/mentionWebhookContext.ts
// Pure helpers that enrich the outgoing `mention` webhook payload with
// stable, backward-compatible context (titles, actor display name, and a
// safely bounded plain-text source preview).
// [why] pure and side-effect-free so payload shaping is unit-testable
//       without DB/network mocks, and identical across all dispatch sites.
// [why] no email addresses ever leave the server in webhook payloads —
//       actor names are checked and dropped when they look like emails.

import { sanitizeText } from '../../../common/sanitize';

const PREVIEW_MAX_LENGTH = 200;
const EMAIL_LIKE = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/;
const RICH_TEXT_BREAK_TAGS =
  /<\/?(?:address|article|aside|blockquote|br|div|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

/**
 * Convert rich source text (card description / comment content) into a
 * plain-text preview safe for external webhook consumers:
 * - strips all HTML markup (sanitizes to text, decodes entities)
 * - replaces newlines, tabs, and control characters with single spaces
 * - collapses runs of whitespace into one space and trims
 * - caps the result at PREVIEW_MAX_LENGTH characters, appending an
 *   ellipsis character only when truncation actually happened
 */
export function buildSourcePreview({
  sourceText,
}: {
  sourceText?: string | null | undefined;
}): string {
  if (!sourceText) return '';

  // [why] sanitizeText strips ALL tags and decodes HTML entities to plain text.
  // [why] if sanitization throws, return an empty preview rather than leaking
  //       unsanitized source text to external consumers.
  let text: string;
  try {
    text = sanitizeText(sourceText.replace(RICH_TEXT_BREAK_TAGS, ' '));
  } catch {
    return '';
  }

  // [why] replace control chars (incl. \r\n\t) with spaces, then collapse runs.
  const collapsed = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (collapsed.length === 0) return '';
  if (collapsed.length <= PREVIEW_MAX_LENGTH) return collapsed;
  // [why] PREVIEW_MAX_LENGTH is a TOTAL cap: 199 chars + 1-char ellipsis keeps
  //       the ellipsis inside the cap for receivers that hard-truncate at 200.
  return `${collapsed.slice(0, PREVIEW_MAX_LENGTH - 1)}…`;
}

/**
 * Pick the safest actor display name for an external payload.
 * Preference order: a non-email nickname, then a non-email display name.
 * Returns null when neither is available without leaking an email address.
 */
export function buildActorDisplayName({
  nickname,
  name,
}: {
  nickname?: string | null | undefined;
  name?: string | null | undefined;
}): string | null {
  const nick = (nickname ?? '').trim();
  if (nick.length > 0 && !EMAIL_LIKE.test(nick)) return nick;

  const display = (name ?? '').trim();
  if (display.length > 0 && !EMAIL_LIKE.test(display)) return display;

  return null;
}

export interface MentionWebhookPayload extends Record<string, unknown> {
  boardId: string;
  cardId: string | null;
  sourceType: 'card_description' | 'comment';
  sourceId: string;
  actorId: string;
  mentionedUserIds: string[];
  cardTitle: string;
  boardTitle: string;
  sourcePreview: string;
  actorName: string | null;
}

export function buildMentionWebhookPayload({
  boardId,
  cardId,
  sourceType,
  sourceId,
  actorId,
  recipients,
  cardTitle,
  boardName,
  sourceText,
  actor,
}: {
  boardId: string;
  cardId: string | null;
  sourceType: 'card_description' | 'comment';
  sourceId: string;
  actorId: string;
  recipients: string[];
  cardTitle?: string | undefined;
  boardName?: string | undefined;
  sourceText?: string | undefined;
  actor: Record<string, unknown>;
}): MentionWebhookPayload {
  const actorNickname = typeof actor['nickname'] === 'string' ? actor['nickname'] : null;
  const actorName = typeof actor['name'] === 'string' ? actor['name'] : null;
  return {
    boardId,
    cardId,
    sourceType,
    sourceId,
    actorId,
    mentionedUserIds: [...recipients],
    cardTitle: cardTitle ?? '',
    boardTitle: boardName ?? '',
    sourcePreview: buildSourcePreview({ sourceText }),
    actorName: buildActorDisplayName({ nickname: actorNickname, name: actorName }),
  };
}
