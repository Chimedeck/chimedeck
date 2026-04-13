// Orphan cleanup: removes PENDING attachments (and their S3 objects) that were
// never confirmed more than 1 hour after creation.
import { db } from '../../../common/db';
import { deleteObject } from './s3/deleteObject';

const ORPHAN_TTL_MS = 60 * 60 * 1000; // 1 hour

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
        // Best-effort S3 deletion — proceed to remove DB row regardless
      }
    }
    await db('attachments').where({ id: attachment.id }).delete();
  }
}

// Schedule cleanup to run every 15 minutes when this module is imported.
// The interval reference is kept in module scope so it can be cleared in tests.
export const orphanCleanupInterval = setInterval(cleanupOrphanAttachments, 15 * 60 * 1000);
