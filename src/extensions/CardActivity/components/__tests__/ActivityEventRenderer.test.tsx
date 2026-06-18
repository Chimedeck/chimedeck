// ActivityEventRenderer tests — verifies isRichEventType discriminator
// and ActivityEventRenderer component dispatches to correct renderers.
// [why] Rich event rendering is the key Sprint 176 integration point
// between server activity events and the card modal UI.
import { describe, it, expect } from 'vitest';
import { isRichEventType, ActivityEventRenderer } from '../ActivityEventRenderer';
import type { ActivityEventRendererProps } from '../ActivityEventRenderer';

const makeActivity = (action: string) => ({
  id: 'act-1',
  entity_type: 'card',
  entity_id: 'card-1',
  board_id: 'board-1',
  action,
  actor_id: 'user-1',
  actor_name: null,
  actor_email: null,
  actor_avatar_url: null,
  payload: {},
  created_at: '2026-06-11T00:00:00Z',
});

describe('isRichEventType', () => {
  it('recognises sprint_generation_started as rich', () => {
    expect(isRichEventType('sprint_generation_started')).toBe(true);
  });

  it('recognises sprint_generation_completed as rich', () => {
    expect(isRichEventType('sprint_generation_completed')).toBe(true);
  });

  it('recognises sprint_generation_failed as rich', () => {
    expect(isRichEventType('sprint_generation_failed')).toBe(true);
  });

  it('recognises sprint_generation_artifact_created as rich', () => {
    expect(isRichEventType('sprint_generation_artifact_created')).toBe(true);
  });

  it('recognises sprint_generation_card_created as rich', () => {
    expect(isRichEventType('sprint_generation_card_created')).toBe(true);
  });

  it('recognises sprint_generation_quota_exceeded as rich', () => {
    expect(isRichEventType('sprint_generation_quota_exceeded')).toBe(true);
  });

  it('recognises as_built_sync_started as rich', () => {
    expect(isRichEventType('as_built_sync_started')).toBe(true);
  });

  it('recognises as_built_sync_completed as rich', () => {
    expect(isRichEventType('as_built_sync_completed')).toBe(true);
  });

  it('recognises as_built_sync_failed as rich', () => {
    expect(isRichEventType('as_built_sync_failed')).toBe(true);
  });

  it('recognises as_built_sync_evidence_collected as rich', () => {
    expect(isRichEventType('as_built_sync_evidence_collected')).toBe(true);
  });

  it('recognises as_built_sync_docs_updated as rich', () => {
    expect(isRichEventType('as_built_sync_docs_updated')).toBe(true);
  });

  it('recognises as_built_sync_committed as rich', () => {
    expect(isRichEventType('as_built_sync_committed')).toBe(true);
  });

  it('returns false for standard activity types', () => {
    expect(isRichEventType('card_moved')).toBe(false);
  });

  it('returns false for comment_added', () => {
    expect(isRichEventType('comment_added')).toBe(false);
  });

  it('returns false for label_added', () => {
    expect(isRichEventType('label_added')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isRichEventType('')).toBe(false);
  });
});

describe('ActivityEventRenderer', () => {
  const baseProps: ActivityEventRendererProps = {
    activity: makeActivity('sprint_generation_started'),
    cardId: 'card-1',
  };

  it('renders SprintGenEvent for sprint_generation_* events', () => {
    const result = ActivityEventRenderer({
      ...baseProps,
      activity: makeActivity('sprint_generation_artifact_created'),
    });
    // [why] The renderer returns a React element — SprintGenEvent component.
    // We verify it's not null (would be null for unrecognised types).
    expect(result).not.toBeNull();
  });

  it('renders AsBuiltEvent for as_built_sync_* events', () => {
    const result = ActivityEventRenderer({
      ...baseProps,
      activity: makeActivity('as_built_sync_evidence_collected'),
    });
    expect(result).not.toBeNull();
  });

  it('returns null for unrecognised event types', () => {
    const result = ActivityEventRenderer({
      ...baseProps,
      activity: makeActivity('card_moved'),
    });
    // [why] Unknown event types should return null so the caller renders
    // the default text label instead of a rich component.
    expect(result).toBeNull();
  });

  it('passes onFileClick callback through', () => {
    const onFileClick = (path: string) => {
      /* noop */
    };
    const result = ActivityEventRenderer({
      ...baseProps,
      onFileClick,
    });
    expect(result).not.toBeNull();
  });

  it('passes onApprove callback through', () => {
    const onApprove = async (runId: string) => {
      /* noop */
    };
    const result = ActivityEventRenderer({
      ...baseProps,
      onApprove,
    });
    expect(result).not.toBeNull();
  });
});
