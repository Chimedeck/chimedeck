// contract: intervention recipient contract for card.commented webhooks
// [why] Spec is fixed by the QA investigation (parent card t_4552dce2): the WhatsApp
// bridge can only route a comment alert when the payload itself carries the per-user
// targets. Recipients: card assignees + checklist assignees + reply target, minus
// actor and mentioned users, deduplicated, deterministic. Never board-wide.
// Display fields reuse the canonical mention-context helpers so comment and mention
// alerts format identically on the bridge.
import { describe, expect, it } from 'bun:test';
import { computeInterventionRecipients } from '../../../../../server/extensions/comment/common/interventionRecipients';
import { buildCommentWebhookPayload } from '../../../../../server/extensions/comment/common/commentWebhookPayload';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ACTOR = 'u-actor';
const CARD_ASSIGNEE = 'u-card-assignee';
const CHECKLIST_ASSIGNEE = 'u-checklist-assignee';
const REPLY_TARGET = 'u-reply-target';
const MENTIONED = 'u-mentioned';
const BYSTANDER = 'u-bystander';

// ─────────────────────────────────────────────────────────────────────────────
// computeInterventionRecipients — pure helper
// ─────────────────────────────────────────────────────────────────────────────

describe('computeInterventionRecipients', () => {
  it('returns union of card assignees, checklist assignees and reply target', () => {
    const recipients = computeInterventionRecipients({
      cardAssigneeIds: [CARD_ASSIGNEE],
      checklistAssigneeIds: [CHECKLIST_ASSIGNEE],
      replyToUserId: REPLY_TARGET,
      actorId: ACTOR,
      mentionedUserIds: [],
    });
    expect(recipients.sort()).toEqual([CARD_ASSIGNEE, CHECKLIST_ASSIGNEE, REPLY_TARGET].sort());
  });

  it('deduplicates a user who is both card assignee and checklist assignee', () => {
    const recipients = computeInterventionRecipients({
      cardAssigneeIds: [CARD_ASSIGNEE],
      checklistAssigneeIds: [CARD_ASSIGNEE, CHECKLIST_ASSIGNEE],
      replyToUserId: null,
      actorId: ACTOR,
      mentionedUserIds: [],
    });
    expect(recipients).toEqual([CARD_ASSIGNEE, CHECKLIST_ASSIGNEE]);
  });

  it('excludes the actor even when the actor is card assignee, checklist assignee or reply target', () => {
    const recipients = computeInterventionRecipients({
      cardAssigneeIds: [ACTOR, CARD_ASSIGNEE],
      checklistAssigneeIds: [ACTOR, CHECKLIST_ASSIGNEE],
      replyToUserId: ACTOR,
      actorId: ACTOR,
      mentionedUserIds: [],
    });
    expect(recipients.sort()).toEqual([CARD_ASSIGNEE, CHECKLIST_ASSIGNEE].sort());
  });

  it('excludes mentioned users so they receive only the separate mention event', () => {
    const recipients = computeInterventionRecipients({
      cardAssigneeIds: [MENTIONED, CARD_ASSIGNEE],
      checklistAssigneeIds: [],
      replyToUserId: MENTIONED,
      actorId: ACTOR,
      mentionedUserIds: [MENTIONED],
    });
    expect(recipients).toEqual([CARD_ASSIGNEE]);
  });

  it('is deterministic regardless of input order', () => {
    const a = computeInterventionRecipients({
      cardAssigneeIds: [CARD_ASSIGNEE, BYSTANDER],
      checklistAssigneeIds: [CHECKLIST_ASSIGNEE],
      replyToUserId: REPLY_TARGET,
      actorId: ACTOR,
      mentionedUserIds: [],
    });
    const b = computeInterventionRecipients({
      cardAssigneeIds: [BYSTANDER, CARD_ASSIGNEE],
      checklistAssigneeIds: [CHECKLIST_ASSIGNEE],
      replyToUserId: REPLY_TARGET,
      actorId: ACTOR,
      mentionedUserIds: [],
    });
    expect(a).toEqual(b);
  });

  it('ignores null/undefined/whitespace entries defensively', () => {
    const recipients = computeInterventionRecipients({
      cardAssigneeIds: [CARD_ASSIGNEE, ' ', ''] as string[],
      checklistAssigneeIds: [null as unknown as string, CHECKLIST_ASSIGNEE],
      replyToUserId: null,
      actorId: ACTOR,
      mentionedUserIds: [undefined as unknown as string],
    });
    expect(recipients.sort()).toEqual([CARD_ASSIGNEE, CHECKLIST_ASSIGNEE].sort());
  });

  it('self comment on an assigned card produces no intervention recipient', () => {
    const recipients = computeInterventionRecipients({
      cardAssigneeIds: [ACTOR],
      checklistAssigneeIds: [],
      replyToUserId: null,
      actorId: ACTOR,
      mentionedUserIds: [],
    });
    expect(recipients).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCommentWebhookPayload — additive, backward-compatible payload builder
// reusing the canonical mention-context display helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCommentWebhookPayload', () => {
  const base = { commentId: 'c-1', cardId: 'card-1', cardTitle: 'Fix login' };
  const commonInput = {
    base,
    boardId: 'board-1',
    entityId: 'card-1',
    actorId: ACTOR,
    boardTitle: 'Ops',
  };

  it('preserves all existing payload fields untouched', () => {
    const payload = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'Ana', nickname: null },
      commentText: 'hello',
      interventionRecipients: [CARD_ASSIGNEE],
    });
    expect(payload.commentId).toBe('c-1');
    expect(payload.cardId).toBe('card-1');
    expect(payload.cardTitle).toBe('Fix login');
    // existing keys must not be re-typed or renamed
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining(['commentId', 'cardId', 'cardTitle'])
    );
  });

  it('adds interventionUserIds only when recipients exist', () => {
    const payload = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'Ana', nickname: null },
      commentText: 'hello',
      interventionRecipients: [CARD_ASSIGNEE, CHECKLIST_ASSIGNEE],
    });
    expect(payload.interventionUserIds).toEqual([CARD_ASSIGNEE, CHECKLIST_ASSIGNEE]);
  });

  it('omits interventionUserIds when there are no recipients (old consumers see zero change)', () => {
    const payload = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'Ana', nickname: null },
      commentText: 'hello',
      interventionRecipients: [],
    });
    expect('interventionUserIds' in payload).toBe(false);
  });

  it('uses the canonical actor display name: nickname preferred, email never leaked, null when unavailable', () => {
    const withNickname = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'ana@corp.example', nickname: 'ana.ops' },
      commentText: 'hello',
      interventionRecipients: [CARD_ASSIGNEE],
    });
    expect(withNickname.actorName).toBe('ana.ops');

    const nameOnly = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'Ana Silva', nickname: null },
      commentText: 'hello',
      interventionRecipients: [CARD_ASSIGNEE],
    });
    expect(nameOnly.actorName).toBe('Ana Silva');

    const emailOnly = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'ana@corp.example', nickname: 'ana@corp.example' },
      commentText: 'hello',
      interventionRecipients: [CARD_ASSIGNEE],
    });
    // [why] canonical helper returns null rather than a placeholder — the bridge
    // decides its own fallback formatting
    expect(emailOnly.actorName).toBeNull();
    expect(JSON.stringify(emailOnly).includes('ana@corp.example')).toBe(false);
  });

  it('builds sourcePreview with canonical semantics via the shared mention-context helper', async () => {
    const { buildSourcePreview } =
      await import('../../../../../server/extensions/notifications/mods/mentionWebhookContext');

    // [why] delegation contract: the comment payload preview IS the canonical
    // helper's output for the same input (entity decoding, whitespace collapse,
    // 200-char total cap) — compared against the helper itself so this test does
    // not depend on the shared sanitize module's load-order state.
    const rich = '<p>Hi <b>@bob</b>, please&nbsp;review</p>';
    const decoded = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'Ana', nickname: null },
      commentText: rich,
      interventionRecipients: [CARD_ASSIGNEE],
    });
    expect(decoded.sourcePreview).toBe(buildSourcePreview({ sourceText: rich }));

    const long = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'Ana', nickname: null },
      commentText: 'x'.repeat(500),
      interventionRecipients: [CARD_ASSIGNEE],
    });
    // 199 chars + ellipsis = 200 total, matching the mention payload contract
    expect((long.sourcePreview as string).length).toBe(200);
    expect((long.sourcePreview as string).endsWith('…')).toBe(true);

    const short = buildCommentWebhookPayload({
      ...commonInput,
      actor: { name: 'Ana', nickname: null },
      commentText: 'y'.repeat(200),
      interventionRecipients: [CARD_ASSIGNEE],
    });
    expect(short.sourcePreview).toBe('y'.repeat(200));
  });

  it('does not mutate the base payload object', () => {
    const baseObj = { commentId: 'c-1', cardId: 'card-1', cardTitle: 'Fix login' };
    buildCommentWebhookPayload({
      base: baseObj,
      boardId: 'board-1',
      entityId: 'card-1',
      actorId: ACTOR,
      actor: { name: 'Ana', nickname: null },
      commentText: 'hello',
      boardTitle: 'Ops',
      interventionRecipients: [CARD_ASSIGNEE],
    });
    expect(Object.keys(baseObj)).toEqual(['commentId', 'cardId', 'cardTitle']);
  });
});
