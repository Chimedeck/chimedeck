import { createHash, timingSafeEqual } from 'node:crypto';

export type PushEnvironment = 'development' | 'production';
export interface DeviceInput {
  id: string;
  secret: string;
  token: string;
  platform: 'android' | 'ios';
  environment: PushEnvironment;
}
export function parseDevice({ body }: { body: unknown }): DeviceInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.id !== 'string' ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(b.id) ||
    typeof b.secret !== 'string' ||
    b.secret.length < 32 ||
    b.secret.length > 256 ||
    typeof b.token !== 'string' ||
    b.token.length < 20 ||
    b.token.length > 4096 ||
    typeof b.platform !== 'string' ||
    !['android', 'ios'].includes(b.platform) ||
    typeof b.environment !== 'string' ||
    !['development', 'production'].includes(b.environment)
  )
    return null;
  return b as unknown as DeviceInput;
}
export function secretHash({ secret }: { secret: string }): string {
  return createHash('sha256').update(secret).digest('hex');
}
export function ownsDevice({ secret, hash }: { secret: unknown; hash: string }): boolean {
  if (typeof secret !== 'string' || secret.length < 32 || secret.length > 256) return false;
  const actual = Buffer.from(secretHash({ secret }), 'hex'),
    expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export interface PushData {
  notification_id: string;
  user_id: string;
  environment: string;
  card_id: string;
  board_id: string;
  comment_id: string;
  parent_id: string;
}
export function pushData({
  notification,
  userId,
  environment,
}: {
  notification: Record<string, unknown>;
  userId: string;
  environment: string;
}): PushData {
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 256) : '');
  return {
    notification_id: text(notification.id),
    user_id: userId,
    environment,
    card_id: text(notification.card_id),
    board_id: text(notification.board_id),
    comment_id: notification.source_type === 'comment' ? text(notification.source_id) : '',
    parent_id: text(notification.source_parent_id),
  };
}
export function pushBody({ type }: { type: unknown }): string {
  switch (type) {
    case 'mention':
      return 'You were mentioned in a card.';
    case 'card_commented':
      return 'A card has a new comment.';
    case 'comment_reaction':
      return 'Someone reacted to a comment.';
    case 'card_moved':
      return 'A card moved to another list.';
    case 'card_member_assigned':
      return 'A card assignment changed.';
    default:
      return 'You have a new notification.';
  }
}
export const invalidTokenCodes = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
export function retryDelay({ attempts }: { attempts: number }): number {
  return Math.min(3600, 15 * 2 ** Math.max(0, attempts - 1)) * 1000;
}
