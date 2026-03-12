// Pushes an attachment ID onto the Redis virus-scan job queue.
// Falls back silently when VIRUS_SCAN_ENABLED is false — the worker simply won't run.
// When scanning is disabled the attachment is immediately promoted to READY so the
// UI does not get stuck showing "Uploading".
import { env } from '../../../../config/env';
import { pubsub } from '../../../../mods/pubsub/index';
import { db } from '../../../../common/db';

const SCAN_QUEUE_KEY = 'virus_scan_queue';

export async function enqueueScan({ attachmentId }: { attachmentId: string }): Promise<void> {
  if (!env.VIRUS_SCAN_ENABLED) {
    // No scanner running — mark ready immediately so the UI reflects the correct state.
    await db('attachments').where({ id: attachmentId }).update({ status: 'READY' });
    return;
  }

  // Re-use the Redis client via the pubsub module if available.
  // We publish a special internal channel; the worker subscribes to it.
  // TODO: replace with a proper Redis LPUSH when a dedicated queue client is added.
  await pubsub.publish(SCAN_QUEUE_KEY, JSON.stringify({ attachmentId }));
}
