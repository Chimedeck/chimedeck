// Reconciliation logic for merging a local draft with a server draft.
// WHY: a user may have edited on two devices (or before/after a page reload)
// so both local IndexedDB and the server may have a draft. This module decides
// which version wins using a simple last-write-wins policy keyed on the
// client_updated_at / updatedAt timestamps.
//
// Policy (last-write-wins):
//   - If only one side has a draft → that side wins.
//   - If both sides have a draft → the one with the later timestamp wins.
//   - Clock-skew safety: if timestamps are equal (within 1 ms) → server wins
//     because the server version was already persisted remotely.
//
// The result includes a `source` field so callers know where the winning
// version came from and can decide whether to back-sync the loser.

import type { LocalDraft } from './storage';
import type { ServerDraft } from './api';

export type ReconcileSource = 'local' | 'server' | 'none';

/** Returns true if the given intent represents a queued action that has not yet been applied. */
function isPendingIntent(intent: string | null | undefined): intent is 'save_pending' | 'submit_pending' {
  return intent === 'save_pending' || intent === 'submit_pending';
}

export interface ReconcileResult {
  /** The winning draft content, or null when both sides are absent. */
  contentMarkdown: string | null;
  intent: LocalDraft['intent'] | null;
  /** ISO-8601 timestamp of the winning draft's last edit. */
  updatedAt: string | null;
  /** Which side the winner came from. 'none' means no draft exists anywhere. */
  source: ReconcileSource;
  /**
   * When the LOSING side had an action-pending intent, this field captures it.
   * [why] Callers need to surface a conflict warning when an offline action
   * (save_pending or submit_pending) was overwritten by a newer server draft.
   * If null, no pending action was lost in reconciliation.
   */
  loserPendingIntent: 'save_pending' | 'submit_pending' | null;
}

/**
 * Reconcile a local draft against a server draft.
 * Both arguments are optional — pass null when that side has no draft.
 */
export function reconcileDrafts(
  local: LocalDraft | null,
  server: ServerDraft | null,
): ReconcileResult {
  if (!local && !server) {
    return { contentMarkdown: null, intent: null, updatedAt: null, source: 'none', loserPendingIntent: null };
  }

  if (local && !server) {
    return {
      contentMarkdown: local.contentMarkdown,
      intent: local.intent,
      updatedAt: local.updatedAt,
      source: 'local',
      loserPendingIntent: null,
    };
  }

  if (!local && server) {
    return {
      contentMarkdown: server.content_markdown,
      intent: server.intent,
      updatedAt: server.client_updated_at,
      source: 'server',
      loserPendingIntent: null,
    };
  }

  // Both sides have a draft — compare timestamps.
  const localMs = new Date(local!.updatedAt).getTime();
  const serverMs = new Date(server!.client_updated_at).getTime();

  // [why] Treat equal timestamps as a server win to avoid a pointless re-upload
  // and because the server's version has already been durably persisted.
  if (localMs > serverMs) {
    return {
      contentMarkdown: local!.contentMarkdown,
      intent: local!.intent,
      updatedAt: local!.updatedAt,
      source: 'local',
      // [why] Server lost — if server had a pending intent, surface it so callers can
      // warn the user that a cross-device pending action may need attention.
      loserPendingIntent: isPendingIntent(server!.intent) ? server!.intent : null,
    };
  }

  return {
    contentMarkdown: server!.content_markdown,
    intent: server!.intent,
    updatedAt: server!.client_updated_at,
    source: 'server',
    // [why] Local lost — if local had a pending action (save_pending / submit_pending),
    // the user's offline work was overwritten by a newer server draft. Surface this
    // so callers can show a conflict warning ("Retry Save" / "Retry Post").
    loserPendingIntent: isPendingIntent(local!.intent) ? local!.intent : null,
  };
}

/**
 * Convenience wrapper: fetch the winning content from a list of server drafts
 * matched to a local draft of a specific type.
 *
 * Returns the reconcile result ready to be applied to the editor state.
 */
export function reconcileDraftForType({
  local,
  serverDrafts,
  draftType,
}: {
  local: LocalDraft | null;
  serverDrafts: ServerDraft[];
  draftType: 'description' | 'comment';
}): ReconcileResult {
  const server = serverDrafts.find((d) => d.draft_type === draftType) ?? null;
  return reconcileDrafts(local, server);
}
