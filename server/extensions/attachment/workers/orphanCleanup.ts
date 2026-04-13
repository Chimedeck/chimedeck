// Orphan cleanup worker: deletes PENDING FILE attachments older than 1 hour
// from both S3 and the DB. Runs every 30 minutes per Sprint 59 spec.
import { db } from '../../../common/db';
import { deleteObject } from '../mods/s3/deleteObject';

const ORPHAN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes per spec

export async function cleanupOrphanAttachments(): Promise<void> {
  const cutoff = new Date(Date.now() - ORPHAN_TTL_MS).toISOString();

  const orphans = await db('attachments')
    .where({ type: 'FILE', status: 'PENDING' })
    .where('created_at', '<', cutoff);

  for (const attachment of orphans) {
    const keysToDelete = [attachment.s3_key, attachment.thumbnail_key].filter(
      (key): key is string => typeof key === 'string' && key.length > 0,
    );

    for (const s3Key of keysToDelete) {
      try {
        await deleteObject({ s3Key });
      } catch {
        // Best-effort: always remove DB row even if S3 deletion fails
      }
    }
    await db('attachments').where({ id: attachment.id }).delete();
    console.info(`[orphan-cleanup] deleted attachment ${attachment.id}`);
  }
}

/** Interval ref exported so callers (and tests) can cancel the timer. */
export let orphanCleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startOrphanCleanupWorker(): void {
  orphanCleanupInterval = setInterval(cleanupOrphanAttachments, CLEANUP_INTERVAL_MS);
}
