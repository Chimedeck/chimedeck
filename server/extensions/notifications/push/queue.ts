import { db } from '../../../common/db';
import { env } from '../../../config/env';
import { pushData, type PushEnvironment } from './contracts';
import { pushEnabled, sendPush } from './firebase';
import { deliverPushJob, type PushJobStore, type PushRecipient } from './delivery';
import { boardPreferenceGuard, resolveNotificationChannels } from '../mods/boardPreferenceGuard';
import { globalPreferenceGuard } from '../mods/globalPreferenceGuard';
import { preferenceGuard, type NotificationType } from '../mods/preferenceGuard';

export async function queueNotificationPush({
  userId,
  message,
}: {
  userId: string;
  message: object;
}): Promise<void> {
  if (!env.MOBILE_PUSH_ENABLED) return;
  const event = message as { type?: unknown; payload?: { notification?: Record<string, unknown> } };
  const notification = event.payload?.notification;
  if (
    event.type !== 'notification_created' ||
    !notification ||
    typeof notification.id !== 'string' ||
    notification.type === 'card_updated'
  )
    return;
  const devices = await db('notification_devices')
    .where({ user_id: userId, enabled: true })
    .select('id', 'environment');
  const rows = devices
    .filter((d) => pushEnabled({ environment: d.environment as PushEnvironment }))
    .map((device) => ({
      notification_id: notification.id,
      device_id: device.id,
      user_id: userId,
      payload: JSON.stringify({ ...notification, comment_content: undefined }),
    }));
  if (rows.length)
    await db('notification_push_jobs')
      .insert(rows)
      .onConflict(['notification_id', 'device_id'])
      .ignore();
}

let running = false;
export async function deliverPushBatch({
  send = sendPush,
}: {
  send?: (recipient: PushRecipient) => Promise<void>;
} = {}): Promise<void> {
  if (running || !env.MOBILE_PUSH_ENABLED) return;
  running = true;
  try {
    const jobs = await db.transaction(async (trx) => {
      const selected = await trx('notification_push_jobs')
        .whereNull('failed_at')
        .where('next_attempt_at', '<=', new Date())
        .where((q) => q.whereNull('locked_until').orWhere('locked_until', '<', new Date()))
        .orderBy('id')
        .limit(20)
        .forUpdate()
        .skipLocked();
      if (selected.length)
        await trx('notification_push_jobs')
          .whereIn(
            'id',
            selected.map((j) => j.id)
          )
          .update({ locked_until: new Date(Date.now() + 60_000) });
      return selected;
    });
    const store: PushJobStore = {
      async recipient(job) {
        const device = await db('notification_devices')
          .where({ id: job.device_id, user_id: job.user_id, enabled: true })
          .first();
        const notification = await db('notifications')
          .where({ id: job.notification_id, user_id: job.user_id, read: false })
          .first();
        if (
          !device ||
          !notification ||
          !pushEnabled({ environment: device.environment }) ||
          !(await globalPreferenceGuard({ userId: job.user_id }))
        )
          return null;
        const channels = notification.board_id
          ? await resolveNotificationChannels({
              userId: job.user_id,
              boardId: notification.board_id,
              type: notification.type as NotificationType,
            })
          : await preferenceGuard({
              userId: job.user_id,
              type: notification.type as NotificationType,
            }).then((p) => ({ inApp: p.in_app_enabled }));
        if (
          !channels.inApp ||
          (notification.board_id &&
            !(await boardPreferenceGuard({ userId: job.user_id, boardId: notification.board_id })))
        )
          return null;
        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
        // Creation-time WebSocket payloads can omit the reply's parent. Resolve
        // it from the authorized notification source before building tap data.
        if (notification.source_type === 'comment' && payload && typeof payload === 'object') {
          const comment = await db('comments')
            .where({ id: notification.source_id, card_id: notification.card_id })
            .select('parent_id')
            .first();
          (payload as Record<string, unknown>).source_parent_id = comment?.parent_id ?? null;
        }
        return {
          token: device.token,
          environment: device.environment,
          data: pushData({
            notification: payload as Record<string, unknown>,
            userId: job.user_id,
            environment: device.environment,
          }),
          type: notification.type,
        };
      },
      async complete(job) {
        await db('notification_push_jobs').where({ id: job.id }).delete();
      },
      async invalidate(job, token) {
        await db('notification_devices')
          .where({ id: job.device_id, user_id: job.user_id, token })
          .update({ enabled: false });
      },
      async retry(job, attempts, delay, exhausted) {
        await db('notification_push_jobs')
          .where({ id: job.id })
          .update({
            attempts,
            locked_until: null,
            next_attempt_at: new Date(Date.now() + delay),
            failed_at: exhausted ? new Date() : null,
          });
      },
    };
    await Promise.all(jobs.map((job) => deliverPushJob({ job, store, send })));
  } finally {
    running = false;
  }
}
export function startPushDelivery(): void {
  if (!env.MOBILE_PUSH_ENABLED) return;
  const timer = setInterval(() => {
    void deliverPushBatch().catch(() =>
      console.warn('Mobile push delivery is temporarily unavailable.')
    );
  }, 5000);
  timer.unref();
}
