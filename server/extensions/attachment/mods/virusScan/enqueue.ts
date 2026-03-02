// Pushes an attachment ID onto the Redis virus-scan job queue.
// Falls back silently when VIRUS_SCAN_ENABLED is false — the worker simply won't run.
import { env } from '../../../../config/env';
import { pubsub } from '../../../../mods/pubsub/index';

const SCAN_QUEUE_KEY = 'virus_scan_queue';

export async function enqueueScan({ attachmentId }: { attachmentId: string }): Promise<void> {
  if (!env.VIRUS_SCAN_ENABLED) return;

  // Re-use the Redis client via the pubsub module if available.
  // We publish a special internal channel; the worker subscribes to it.
  // TODO: replace with a proper Redis LPUSH when a dedicated queue client is added.
  await pubsub.publish(SCAN_QUEUE_KEY, JSON.stringify({ attachmentId }));
}
