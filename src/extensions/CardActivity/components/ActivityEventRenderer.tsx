// ActivityEventRenderer — dispatches system activity events to rich
// component renderers based on event type. (Sprint 176)
// [why] Sprint 176 events (sprint_generation_*, as_built_sync_*) carry
// structured payloads that benefit from visual diff summaries, artifact
// links, and approve/re-run controls. All other event types fall through
// to the default label-only rendering.
import React from 'react';
import type { ActivityData } from '~/extensions/Card/slices/cardDetailSlice';
import SprintGenEvent from '../renderers/SprintGenEvent';
import AsBuiltEvent from '../renderers/AsBuiltEvent';

export interface ActivityEventRendererProps {
  /** The raw activity event from the card detail slice. */
  activity: ActivityData;
  /** Card ID for context linking. */
  cardId: string;
  /** Optional callback when a file path is clicked. */
  onFileClick?: (path: string) => void;
  /** Optional callback for approve action. */
  onApprove?: (runId: string) => void | Promise<void>;
  /** Optional callback for re-run action. */
  onRerun?: (runId: string) => void | Promise<void>;
  /** Optional callback for edit action. */
  onEdit?: (runId: string) => void | Promise<void>;
}

/** Sprint generation event type prefix. */
const SPRINT_GEN_PREFIX = 'sprint_generation_';

/** As-built sync event type prefix. */
const AS_BUILT_PREFIX = 'as_built_sync_';

/**
 * Check whether the given activity event should be rendered with a rich
 * component rather than the default text label.
 */
export function isRichEventType(action: string): boolean {
  return action.startsWith(SPRINT_GEN_PREFIX) || action.startsWith(AS_BUILT_PREFIX);
}

/**
 * Render a sprint 176 activity event with rich UI (diff summary, artifact
 * links, controls). Falls through to null if the event type is unknown.
 * Callers should fall back to default label rendering when this returns null.
 */
export function ActivityEventRenderer({
  activity,
  cardId,
  onFileClick,
  onApprove,
  onRerun,
  onEdit,
}: ActivityEventRendererProps): React.ReactNode {
  const { action } = activity;

  if (action.startsWith(SPRINT_GEN_PREFIX)) {
    return (
      <SprintGenEvent
        activity={activity}
        cardId={cardId}
        onFileClick={onFileClick}
        onApprove={onApprove}
        onRerun={onRerun}
        onEdit={onEdit}
      />
    );
  }

  if (action.startsWith(AS_BUILT_PREFIX)) {
    return (
      <AsBuiltEvent
        activity={activity}
        cardId={cardId}
        onFileClick={onFileClick}
        onApprove={onApprove}
        onRerun={onRerun}
        onEdit={onEdit}
      />
    );
  }

  // Unknown event type — caller should use default label rendering
  return null;
}
