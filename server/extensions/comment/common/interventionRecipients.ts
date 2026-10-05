// Pure recipient computation for comment intervention alerts.
// [why] The Duplanet WhatsApp bridge routes card.commented alerts using the
// interventionUserIds list carried in the webhook payload. A comment must alert
// only users who are materially involved with the card — card assignees,
// checklist assignees, and the reply target — never the whole board, never the
// actor, and never mentioned users (they receive the dedicated mention event,
// so including them here would double-notify across events).

export interface InterventionRecipientsInput {
  cardAssigneeIds: ReadonlyArray<string | null | undefined>;
  checklistAssigneeIds: ReadonlyArray<string | null | undefined>;
  replyToUserId: string | null;
  actorId: string;
  mentionedUserIds: ReadonlyArray<string | null | undefined>;
}

const isNonEmptyId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '';

/**
 * Deterministic, deduplicated, order-invariant intervention recipient list:
 * (card assignees ∪ checklist assignees ∪ reply target) − actor − mentioned users.
 * The result is sorted so any input permutation yields the identical output —
 * the bridge can diff/compare payloads without order sensitivity.
 */
export function computeInterventionRecipients({
  cardAssigneeIds,
  checklistAssigneeIds,
  replyToUserId,
  actorId,
  mentionedUserIds,
}: InterventionRecipientsInput): string[] {
  const mentioned = new Set(mentionedUserIds.filter(isNonEmptyId).map((id) => id.trim()));

  const recipients = new Set<string>();
  const consider = (candidate: string | null | undefined): void => {
    if (!isNonEmptyId(candidate)) return;
    const id = candidate.trim();
    if (id === actorId) return;
    if (mentioned.has(id)) return;
    recipients.add(id);
  };

  for (const id of cardAssigneeIds) consider(id);
  for (const id of checklistAssigneeIds) consider(id);
  consider(replyToUserId);

  return Array.from(recipients).sort();
}
