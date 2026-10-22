import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../../../config/env';
import { pushBody, type PushData, type PushEnvironment } from './contracts';

export function pushEnabled({ environment }: { environment: PushEnvironment }): boolean {
  return (
    env.MOBILE_PUSH_ENABLED &&
    Boolean(
      environment === 'development'
        ? env.MOBILE_PUSH_DEVELOPMENT_CREDENTIALS_JSON
        : env.MOBILE_PUSH_PRODUCTION_CREDENTIALS_JSON
    )
  );
}
export async function sendPush({
  token,
  environment,
  data,
  type,
}: {
  token: string;
  environment: PushEnvironment;
  data: PushData;
  type: unknown;
}): Promise<void> {
  if (!pushEnabled({ environment })) throw new Error('push-not-configured');
  const name = 'chimedeck-push-' + environment;
  let app = getApps().find((candidate) => candidate.name === name);
  if (!app) {
    const raw =
      environment === 'development'
        ? env.MOBILE_PUSH_DEVELOPMENT_CREDENTIALS_JSON
        : env.MOBILE_PUSH_PRODUCTION_CREDENTIALS_JSON;
    // The explicit ADC option avoids copying a service-account JSON on managed hosts.
    const credential = raw === 'application-default' ? applicationDefault() : cert(JSON.parse(raw));
    app = initializeApp({ credential }, name);
  }
  await getMessaging(app).send({
    token,
    notification: { title: 'Chimedeck', body: pushBody({ type }) },
    data: { ...data },
    android: {
      ttl: 3600_000,
      notification: {
        channelId: 'chimedeck_activity',
        tag: data.notification_id,
        icon: 'ic_notification',
      },
    },
    apns: {
      headers: {
        'apns-collapse-id': data.notification_id,
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      },
      payload: { aps: { sound: 'default', threadId: 'chimedeck_activity' } },
    },
  });
}
