import { invalidTokenCodes, retryDelay, type PushData, type PushEnvironment } from './contracts';

export interface PushJob {
  id: string | number;
  notification_id: string;
  device_id: string;
  user_id: string;
  payload: unknown;
  attempts: number;
}
export interface PushRecipient {
  token: string;
  environment: PushEnvironment;
  data: PushData;
  type: string;
}
export interface PushJobStore {
  recipient(job: PushJob): Promise<PushRecipient | null>;
  complete(job: PushJob): Promise<void>;
  invalidate(job: PushJob, token: string): Promise<void>;
  retry(job: PushJob, attempts: number, delay: number, exhausted: boolean): Promise<void>;
}
export async function deliverPushJob({
  job,
  store,
  send,
}: {
  job: PushJob;
  store: PushJobStore;
  send: (recipient: PushRecipient) => Promise<void>;
}): Promise<void> {
  let recipient: PushRecipient | null = null;
  try {
    recipient = await store.recipient(job);
    if (recipient) await send(recipient);
    await store.complete(job);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (recipient && invalidTokenCodes.has(code)) {
      await store.invalidate(job, recipient.token);
      await store.complete(job);
    } else {
      const attempts = Number(job.attempts) + 1;
      await store.retry(job, attempts, retryDelay({ attempts }), attempts >= 8);
    }
  }
}
