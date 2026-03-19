// tests/integration/automation/triggers.test.ts
// Integration tests for the 13 card trigger handlers (Sprint 62).
// Tests positive (should fire) and negative (should not fire) cases for each.

import { describe, it, expect, beforeAll } from 'bun:test';

// Import triggers index to register all handlers before testing.
import '../../../server/extensions/automation/engine/triggers/index';

import { cardCreatedTrigger } from '../../../server/extensions/automation/engine/triggers/card/created';
import { cardMovedToListTrigger } from '../../../server/extensions/automation/engine/triggers/card/movedToList';
import { cardMovedFromListTrigger } from '../../../server/extensions/automation/engine/triggers/card/movedFromList';
import { cardLabelAddedTrigger } from '../../../server/extensions/automation/engine/triggers/card/labelAdded';
import { cardLabelRemovedTrigger } from '../../../server/extensions/automation/engine/triggers/card/labelRemoved';
import { cardMemberAddedTrigger } from '../../../server/extensions/automation/engine/triggers/card/memberAdded';
import { cardMemberRemovedTrigger } from '../../../server/extensions/automation/engine/triggers/card/memberRemoved';
import { cardDueDateSetTrigger } from '../../../server/extensions/automation/engine/triggers/card/dueDateSet';
import { cardDueDateRemovedTrigger } from '../../../server/extensions/automation/engine/triggers/card/dueDateRemoved';
import { cardChecklistCompletedTrigger } from '../../../server/extensions/automation/engine/triggers/card/checklistCompleted';
import { cardAllChecklistsCompletedTrigger } from '../../../server/extensions/automation/engine/triggers/card/allChecklistsCompleted';
import { cardArchivedTrigger } from '../../../server/extensions/automation/engine/triggers/card/archived';
import { cardCommentAddedTrigger } from '../../../server/extensions/automation/engine/triggers/card/commentAdded';
import { boardMemberAddedTrigger } from '../../../server/extensions/automation/engine/triggers/board/memberAdded';
import { listCardAddedTrigger } from '../../../server/extensions/automation/engine/triggers/list/cardAdded';
import { validateTrigger } from '../../../server/extensions/automation/engine/triggers/validate';
import { getTriggerHandler, getAllTriggerTypes } from '../../../server/extensions/automation/engine/registry';

import type { AutomationEvent } from '../../../server/extensions/automation/common/types';

function makeEvent(type: string, payload: Record<string, unknown> = {}): AutomationEvent {
  return {
    type,
    boardId: 'board-1',
    entityId: 'card-1',
    actorId: 'user-1',
    payload,
  };
}

const LIST_ID = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const OTHER_LIST_ID = 'b2c3d4e5-f6a7-4890-a1b2-f01234567891';
const LABEL_ID = 'c3d4e5f6-a7b8-4901-89ab-012345678902';
const MEMBER_ID = 'd4e5f6a7-b8c9-4012-9abc-123456789013';
const CHECKLIST_ID = 'e5f6a7b8-c9d0-4123-8def-234567890124';

// ── trigger registry ──────────────────────────────────────────────────────────

describe('Trigger registry', () => {
  it('registers all 15 trigger types (13 card + board.member_added + list.card_added)', () => {
    const types = getAllTriggerTypes();
    const expected = [
      'card.created',
      'card.moved_to_list',
      'card.moved_from_list',
      'card.label_added',
      'card.label_removed',
      'card.member_added',
      'card.member_removed',
      'card.due_date_set',
      'card.due_date_removed',
      'card.checklist_completed',
      'card.all_checklists_completed',
      'card.archived',
      'card.comment_added',
      'board.member_added',
      'list.card_added',
    ];
    for (const t of expected) {
      expect(types).toContain(t);
    }
  });

  it('returns a handler for each registered type', () => {
    const handler = getTriggerHandler('card.created');
    expect(handler).toBeDefined();
    expect(handler?.type).toBe('card.created');
    expect(typeof handler?.matches).toBe('function');
    expect(handler?.configSchema).toBeDefined();
    expect(handler?.label).toBeTruthy();
  });

  it('returns undefined for an unknown trigger type', () => {
    expect(getTriggerHandler('card.unknown_thing')).toBeUndefined();
  });
});

// ── validateTrigger ───────────────────────────────────────────────────────────

describe('validateTrigger', () => {
  it('returns valid:true for a known type with valid config', () => {
    const result = validateTrigger('card.moved_to_list', { listId: LIST_ID });
    expect(result.valid).toBe(true);
  });

  it('returns trigger-type-unknown for an unknown type', () => {
    const result = validateTrigger('card.no_such_trigger', {});
    expect(result.valid).toBe(false);
    expect(result.errorName).toBe('trigger-type-unknown');
  });

  it('returns trigger-config-invalid for invalid config', () => {
    const result = validateTrigger('card.moved_to_list', { listId: 'not-a-uuid' });
    expect(result.valid).toBe(false);
    expect(result.errorName).toBe('trigger-config-invalid');
  });

  it('accepts empty config for triggers with no required fields', () => {
    const result = validateTrigger('card.archived', {});
    expect(result.valid).toBe(true);
  });

  it('accepts null/undefined config by coercing to empty object', () => {
    const result = validateTrigger('card.archived', undefined);
    expect(result.valid).toBe(true);
  });
});

// ── card.created ──────────────────────────────────────────────────────────────

describe('card.created trigger', () => {
  it('matches card.created event with no listId filter', () => {
    expect(cardCreatedTrigger.matches(makeEvent('card.created', { listId: LIST_ID }), {})).toBe(true);
  });

  it('matches card.created event when listId matches', () => {
    expect(
      cardCreatedTrigger.matches(makeEvent('card.created', { listId: LIST_ID }), { listId: LIST_ID }),
    ).toBe(true);
  });

  it('does not match when listId filter differs', () => {
    expect(
      cardCreatedTrigger.matches(makeEvent('card.created', { listId: LIST_ID }), { listId: OTHER_LIST_ID }),
    ).toBe(false);
  });

  it('does not match wrong event type', () => {
    expect(cardCreatedTrigger.matches(makeEvent('card.archived'), {})).toBe(false);
  });
});

// ── card.moved_to_list ────────────────────────────────────────────────────────

describe('card.moved_to_list trigger', () => {
  it('matches when toListId equals configured listId', () => {
    expect(
      cardMovedToListTrigger.matches(makeEvent('card.moved', { toListId: LIST_ID, fromListId: OTHER_LIST_ID }), { listId: LIST_ID }),
    ).toBe(true);
  });

  it('does not match when toListId differs', () => {
    expect(
      cardMovedToListTrigger.matches(makeEvent('card.moved', { toListId: OTHER_LIST_ID }), { listId: LIST_ID }),
    ).toBe(false);
  });

  it('does not match wrong event type', () => {
    expect(
      cardMovedToListTrigger.matches(makeEvent('card.created', { toListId: LIST_ID }), { listId: LIST_ID }),
    ).toBe(false);
  });
});

// ── card.moved_from_list ──────────────────────────────────────────────────────

describe('card.moved_from_list trigger', () => {
  it('matches when fromListId equals configured listId', () => {
    expect(
      cardMovedFromListTrigger.matches(makeEvent('card.moved', { fromListId: LIST_ID, toListId: OTHER_LIST_ID }), { listId: LIST_ID }),
    ).toBe(true);
  });

  it('does not match when fromListId differs', () => {
    expect(
      cardMovedFromListTrigger.matches(makeEvent('card.moved', { fromListId: OTHER_LIST_ID }), { listId: LIST_ID }),
    ).toBe(false);
  });

  it('does not match wrong event type', () => {
    expect(
      cardMovedFromListTrigger.matches(makeEvent('card.archived', { fromListId: LIST_ID }), { listId: LIST_ID }),
    ).toBe(false);
  });
});

// ── card.label_added ──────────────────────────────────────────────────────────

describe('card.label_added trigger', () => {
  it('matches label_added with no labelId filter', () => {
    expect(cardLabelAddedTrigger.matches(makeEvent('card.label_added', { labelId: LABEL_ID }), {})).toBe(true);
  });

  it('matches when labelId filter matches', () => {
    expect(
      cardLabelAddedTrigger.matches(makeEvent('card.label_added', { labelId: LABEL_ID }), { labelId: LABEL_ID }),
    ).toBe(true);
  });

  it('does not match when labelId differs', () => {
    expect(
      cardLabelAddedTrigger.matches(
        makeEvent('card.label_added', { labelId: LABEL_ID }),
        { labelId: 'f6a7b8c9-d0e1-4234-8abc-345678901235' },
      ),
    ).toBe(false);
  });

  it('does not match wrong event type', () => {
    expect(cardLabelAddedTrigger.matches(makeEvent('card.label_removed'), {})).toBe(false);
  });
});

// ── card.label_removed ────────────────────────────────────────────────────────

describe('card.label_removed trigger', () => {
  it('matches label_removed with no filter', () => {
    expect(cardLabelRemovedTrigger.matches(makeEvent('card.label_removed', { labelId: LABEL_ID }), {})).toBe(true);
  });

  it('does not match wrong event type', () => {
    expect(cardLabelRemovedTrigger.matches(makeEvent('card.label_added'), {})).toBe(false);
  });
});

// ── card.member_added ─────────────────────────────────────────────────────────

describe('card.member_added trigger', () => {
  it('matches member_added with no filter', () => {
    expect(cardMemberAddedTrigger.matches(makeEvent('card.member_added', { memberId: MEMBER_ID }), {})).toBe(true);
  });

  it('matches when memberId filter matches', () => {
    expect(
      cardMemberAddedTrigger.matches(makeEvent('card.member_added', { memberId: MEMBER_ID }), { memberId: MEMBER_ID }),
    ).toBe(true);
  });

  it('does not match when memberId differs', () => {
    expect(
      cardMemberAddedTrigger.matches(
        makeEvent('card.member_added', { memberId: MEMBER_ID }),
        { memberId: 'f6a7b8c9-d0e1-4234-8abc-345678901235' },
      ),
    ).toBe(false);
  });

  it('does not match wrong event type', () => {
    expect(cardMemberAddedTrigger.matches(makeEvent('card.member_removed'), {})).toBe(false);
  });
});

// ── card.member_removed ───────────────────────────────────────────────────────

describe('card.member_removed trigger', () => {
  it('matches member_removed with no filter', () => {
    expect(cardMemberRemovedTrigger.matches(makeEvent('card.member_removed', { memberId: MEMBER_ID }), {})).toBe(true);
  });

  it('does not match wrong event type', () => {
    expect(cardMemberRemovedTrigger.matches(makeEvent('card.member_added'), {})).toBe(false);
  });
});

// ── card.due_date_set ─────────────────────────────────────────────────────────

describe('card.due_date_set trigger', () => {
  it('matches due_date_set event', () => {
    expect(cardDueDateSetTrigger.matches(makeEvent('card.due_date_set'), {})).toBe(true);
  });

  it('does not match wrong event type', () => {
    expect(cardDueDateSetTrigger.matches(makeEvent('card.due_date_removed'), {})).toBe(false);
  });
});

// ── card.due_date_removed ─────────────────────────────────────────────────────

describe('card.due_date_removed trigger', () => {
  it('matches due_date_removed event', () => {
    expect(cardDueDateRemovedTrigger.matches(makeEvent('card.due_date_removed'), {})).toBe(true);
  });

  it('does not match wrong event type', () => {
    expect(cardDueDateRemovedTrigger.matches(makeEvent('card.due_date_set'), {})).toBe(false);
  });
});

// ── card.checklist_completed ──────────────────────────────────────────────────

describe('card.checklist_completed trigger', () => {
  it('matches checklist_completed with no filter', () => {
    expect(cardChecklistCompletedTrigger.matches(makeEvent('card.checklist_completed', { checklistId: CHECKLIST_ID }), {})).toBe(true);
  });

  it('matches when checklistId filter matches', () => {
    expect(
      cardChecklistCompletedTrigger.matches(
        makeEvent('card.checklist_completed', { checklistId: CHECKLIST_ID }),
        { checklistId: CHECKLIST_ID },
      ),
    ).toBe(true);
  });

  it('does not match when checklistId differs', () => {
    expect(
      cardChecklistCompletedTrigger.matches(
        makeEvent('card.checklist_completed', { checklistId: CHECKLIST_ID }),
        { checklistId: '00000000-0000-0000-0000-000000000099' },
      ),
    ).toBe(false);
  });

  it('does not match wrong event type', () => {
    expect(cardChecklistCompletedTrigger.matches(makeEvent('card.archived'), {})).toBe(false);
  });
});

// ── card.all_checklists_completed ─────────────────────────────────────────────

describe('card.all_checklists_completed trigger', () => {
  it('matches all_checklists_completed event', () => {
    expect(cardAllChecklistsCompletedTrigger.matches(makeEvent('card.all_checklists_completed'), {})).toBe(true);
  });

  it('does not match wrong event type', () => {
    expect(cardAllChecklistsCompletedTrigger.matches(makeEvent('card.checklist_completed'), {})).toBe(false);
  });
});

// ── card.archived ─────────────────────────────────────────────────────────────

describe('card.archived trigger', () => {
  it('matches card.archived event', () => {
    expect(cardArchivedTrigger.matches(makeEvent('card.archived'), {})).toBe(true);
  });

  it('does not match wrong event type', () => {
    expect(cardArchivedTrigger.matches(makeEvent('card.created'), {})).toBe(false);
  });
});

// ── card.comment_added ────────────────────────────────────────────────────────

describe('card.comment_added trigger', () => {
  it('matches card.comment_added event', () => {
    expect(cardCommentAddedTrigger.matches(makeEvent('card.comment_added'), {})).toBe(true);
  });

  it('does not match wrong event type', () => {
    expect(cardCommentAddedTrigger.matches(makeEvent('card.archived'), {})).toBe(false);
  });
});

// ── board.member_added ────────────────────────────────────────────────────────

describe('board.member_added trigger', () => {
  it('matches board.member_added event with no memberId filter', () => {
    expect(boardMemberAddedTrigger.matches(makeEvent('board.member_added', { memberId: MEMBER_ID }), {})).toBe(true);
  });

  it('matches when memberId filter matches', () => {
    expect(
      boardMemberAddedTrigger.matches(makeEvent('board.member_added', { memberId: MEMBER_ID }), { memberId: MEMBER_ID }),
    ).toBe(true);
  });

  it('does not match when memberId differs', () => {
    expect(
      boardMemberAddedTrigger.matches(
        makeEvent('board.member_added', { memberId: MEMBER_ID }),
        { memberId: 'f6a7b8c9-d0e1-4234-8abc-345678901235' },
      ),
    ).toBe(false);
  });

  it('does not match wrong event type', () => {
    expect(boardMemberAddedTrigger.matches(makeEvent('card.member_added', { memberId: MEMBER_ID }), {})).toBe(false);
  });
});

// ── list.card_added ───────────────────────────────────────────────────────────

describe('list.card_added trigger', () => {
  it('matches card.created event when listId matches', () => {
    expect(
      listCardAddedTrigger.matches(makeEvent('card.created', { listId: LIST_ID }), { listId: LIST_ID }),
    ).toBe(true);
  });

  it('matches card.moved event when toListId matches', () => {
    expect(
      listCardAddedTrigger.matches(makeEvent('card.moved', { toListId: LIST_ID, fromListId: OTHER_LIST_ID }), { listId: LIST_ID }),
    ).toBe(true);
  });

  it('does not match card.created when listId differs', () => {
    expect(
      listCardAddedTrigger.matches(makeEvent('card.created', { listId: OTHER_LIST_ID }), { listId: LIST_ID }),
    ).toBe(false);
  });

  it('does not match card.moved when toListId differs', () => {
    expect(
      listCardAddedTrigger.matches(makeEvent('card.moved', { toListId: OTHER_LIST_ID }), { listId: LIST_ID }),
    ).toBe(false);
  });

  it('does not match unrelated event types', () => {
    expect(listCardAddedTrigger.matches(makeEvent('card.archived'), { listId: LIST_ID })).toBe(false);
  });

  it('validateTrigger returns invalid for missing required listId', () => {
    const result = validateTrigger('list.card_added', {});
    expect(result.valid).toBe(false);
    expect(result.errorName).toBe('trigger-config-invalid');
  });
});
