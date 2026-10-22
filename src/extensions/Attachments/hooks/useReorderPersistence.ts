// useReorderPersistence — serialized optimistic-reorder persistence with
// latest-wins failure handling for the attachment list.
//
// [why] Extracted from AttachmentPanel so the scheduling semantics are
// unit-testable in isolation (mirrors the validateReorderOrder extraction):
// - Calls are serialized: each reorder waits for the previous one to settle
//   before sending, so an older request can never commit after a newer one.
// - Only the latest reorder may show the failure toast + trigger the rollback
//   reload; a failed older reorder is silent (a newer one already replaced its
//   order, so its rollback is obsolete).
// - Every persistReorder call bumps a monotonic generation counter and a failed
//   reorder's rollback reload snapshots that counter when its fetch starts — a
//   reload landing after a NEWER reorder was issued therefore discards its
//   pre-reorder snapshot instead of clobbering the newer committed order.
// - The reorder endpoint returns the full serialized attachment list in the new
//   order; on success we reconcile state from that response instead of a
//   separate refetch, so the UI always matches what the server committed.
import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Attachment } from '../types';
import { reorderAttachments } from '../api';
import translations from '../translations/en.json';

interface UseReorderPersistenceOptions {
  cardId: string;
  /** Current committed attachment list; updated from each reorder response. */
  attachmentsRef: MutableRefObject<Attachment[]>;
  /** Apply a new full attachment list (server authoritative). */
  setAttachments: (next: Attachment[]) => void;
  /** Surface an error toast. */
  pushErrorToast: (message: string) => void;
  /** Rollback reload of the authoritative server order (failure of the LATEST reorder only). */
  loadAttachments: () => Promise<void>;
  /**
   * Monotonic reorder generation shared with loadAttachments: bumped synchronously
   * on every persistReorder call; loadAttachments snapshots it at fetch start and
   * discards snapshots taken before a newer bump (stale-refetch guard).
   */
  reorderEpochRef: MutableRefObject<number>;
}

export function useReorderPersistence({
  cardId,
  attachmentsRef,
  setAttachments,
  pushErrorToast,
  loadAttachments,
  reorderEpochRef,
}: UseReorderPersistenceOptions): (order: string[]) => Promise<void> {
  const reorderInFlightRef = useRef<Promise<void> | null>(null);

  return useCallback(
    (order: string[]): Promise<void> => {
      // [why] Bump the reorder generation synchronously (before enqueueing) so any
      // loadAttachments fetch already in flight learns its snapshot is stale —
      // including this call's own failure-rollback reload, which re-fetches AFTER
      // the bump and therefore can never apply a pre-reorder list.
      reorderEpochRef.current += 1;
      const run = async (): Promise<void> => {
        // Wait for the previous reorder to finish before sending ours.
        const prev = reorderInFlightRef.current;
        if (prev) {
          try {
            await prev;
          } catch {
            // Previous call already handled its own failure (rolled back or was
            // superseded — either way our order is newer and must proceed).
          }
        }
        try {
          const res = await reorderAttachments({ cardId, order });
          // [why] The endpoint returns every attachment serialized in the new
          // order — reconcile state from that response instead of a separate
          // refetch, so the UI always matches what the server just committed.
          attachmentsRef.current = res.data;
          setAttachments(res.data);
        } catch {
          // Mark this generation as failed so a racing load snapshot guard stays
          // coherent; then only the LATEST call surfaces the failure + reloads.
          if (reorderInFlightRef.current === task) {
            pushErrorToast(translations['attachments.reorder.failed']);
            void loadAttachments();
          }
        }
      };
      const task = run().finally(() => {
        if (reorderInFlightRef.current === task) reorderInFlightRef.current = null;
      });
      reorderInFlightRef.current = task;
      return task;
    },
    [cardId, attachmentsRef, setAttachments, pushErrorToast, loadAttachments, reorderEpochRef]
  );
}
