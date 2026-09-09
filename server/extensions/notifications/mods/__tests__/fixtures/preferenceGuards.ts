import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

let result: Record<string, boolean> | undefined;
const state: { failure?: Error } = {};
const calls: unknown[] = [];
void mock.module('../../../../../common/db', () => ({
  db(table: string) {
    calls.push(table);
    return {
      where(filter: Record<string, string>) {
        calls.push(filter);
        return this;
      },
      select(...columns: string[]) {
        calls.push(columns);
        return this;
      },
      first() {
        calls.push('first');
        return state.failure ? Promise.reject(state.failure) : Promise.resolve(result);
      },
    };
  },
}));

const { globalPreferenceGuard } = await import('../../globalPreferenceGuard');
const { preferenceGuard, NOTIFICATION_TYPES } = await import('../../preferenceGuard');

for (const enabled of [undefined, true, false]) {
  result = enabled === undefined ? undefined : { global_notifications_enabled: enabled };
  calls.length = 0;
  assert.equal(await globalPreferenceGuard({ userId: 'user-a' }), enabled ?? true);
  assert.deepEqual(calls, ['user_notification_settings', { user_id: 'user-a' }, ['global_notifications_enabled'], 'first']);
}
for (const type of NOTIFICATION_TYPES) {
  for (const row of [undefined, { in_app_enabled: false, email_enabled: false }, { in_app_enabled: true, email_enabled: false }, { in_app_enabled: false, email_enabled: true }, { in_app_enabled: true, email_enabled: true }]) {
    result = row;
    calls.length = 0;
    assert.deepEqual(await preferenceGuard({ userId: 'user-b', type }), row ?? { in_app_enabled: true, email_enabled: true });
    assert.deepEqual(calls, ['notification_preferences', { user_id: 'user-b', type }, ['in_app_enabled', 'email_enabled'], 'first']);
  }
}
const failure = new Error('preference read failed');
state.failure = failure;
await assert.rejects(globalPreferenceGuard({ userId: 'user-a' }), failure);
await assert.rejects(preferenceGuard({ userId: 'user-b', type: 'mention' }), failure);
console.info('real preference guards: defaults, channel combinations, all types, scoped queries, rejection propagation verified');
