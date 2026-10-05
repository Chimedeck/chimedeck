// Builds the additive, backward-compatible card.commented webhook payload.
// [why] Existing subscribers (bridge/Discord, Trello-compat consumers) parse a fixed
// payload shape; the intervention contract must only add fields, never rename or
// re-type existing ones. interventionUserIds is omitted entirely when empty so
// legacy consumers see byte-identical semantics for non-intervention comments.
// [why] Display fields delegate to the canonical mention-context helpers so a
// comment alert and a mention alert format identically downstream (single
// source of truth for entity decoding, whitespace collapsing, the 200-char
// total preview cap and the no-email actor name policy).

import {
  buildActorDisplayName,
  buildSourcePreview,
} from '../../notifications/mods/mentionWebhookContext';

export interface BuildCommentWebhookPayloadInput {
  /** Existing payload fields — forwarded untouched and never mutated. */
  base: Record<string, unknown>;
  boardId: string;
  entityId: string;
  actorId: string;
  /** Actor row (nickname + name) used for the email-safe display name. */
  actor: { nickname?: string | null; name?: string | null };
  /** Raw comment content (possibly rich text) — bounded to a plain-text preview. */
  commentText: string;
  boardTitle: string;
  /** Deduplicated intervention recipients from computeInterventionRecipients(). */
  interventionRecipients: string[];
}

export function buildCommentWebhookPayload({
  base,
  boardId,
  entityId,
  actorId,
  actor,
  commentText,
  boardTitle,
  interventionRecipients,
}: BuildCommentWebhookPayloadInput): Record<string, unknown> {
  // [why] Spread a fresh object — the caller's base payload must never be mutated.
  const payload: Record<string, unknown> = { ...base };

  // Backward-compatibility guard: existing fields keep their original values.
  payload.boardId = boardId;
  payload.entityId = entityId;
  payload.actorId = actorId;

  if (interventionRecipients.length > 0) {
    payload.interventionUserIds = [...interventionRecipients];
  }

  payload.boardTitle = boardTitle;
  payload.actorName = buildActorDisplayName({
    nickname: actor.nickname,
    name: actor.name,
  });
  payload.sourcePreview = buildSourcePreview({ sourceText: commentText });

  return payload;
}
