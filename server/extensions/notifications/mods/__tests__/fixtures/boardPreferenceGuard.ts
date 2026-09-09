import { strict as assert } from 'node:assert';
import { mock } from 'bun:test';

const rows = new Map<string, Record<string, boolean> | undefined>();
const calls: unknown[] = [];
let failingTable = '';
const failure = new Error('board preference read failed');
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
        return table === failingTable ? Promise.reject(failure) : Promise.resolve(rows.get(table));
      },
    };
  },
}));
const { resolveBoardNotificationPreference, boardPreferenceGuard, resolveNotificationChannels } = await import('../../boardPreferenceGuard');
const { NOTIFICATION_TYPES } = await import('../../preferenceGuard');
const scope = { userId: 'user-a', boardId: 'board-b' };
const filter = { user_id: scope.userId, board_id: scope.boardId };
const boardLookup = ['board_notification_preferences', filter, ['notifications_enabled', 'only_related_to_me'], 'first'];
for (const enabled of [false, true]) {
  for (const related of [false, true]) {
    rows.set('board_notification_preferences', { notifications_enabled: enabled, only_related_to_me: related });
    calls.length = 0;
    assert.deepEqual(await resolveBoardNotificationPreference(scope), { notificationsEnabled: enabled, onlyRelatedToMe: related });
    assert.deepEqual(calls, boardLookup);
    calls.length = 0;
    assert.equal(await boardPreferenceGuard(scope), enabled);
    assert.deepEqual(calls, boardLookup);
  }
}
rows.clear();
for (const member of [false, true]) {
  for (const guest of [false, true]) {
    rows.set('board_members', member ? {} : undefined);
    rows.set('board_guest_access', guest ? {} : undefined);
    calls.length = 0;
    assert.deepEqual(await resolveBoardNotificationPreference(scope), { notificationsEnabled: member || guest, onlyRelatedToMe: false });
    assert.deepEqual(calls, [...boardLookup, 'board_members', filter, 'first', 'board_guest_access', filter, 'first']);
    assert.equal(await boardPreferenceGuard(scope), member || guest);
  }
}
rows.clear();
const channelRows = [undefined, { in_app_enabled: false, email_enabled: false }, { in_app_enabled: false, email_enabled: true }, { in_app_enabled: true, email_enabled: false }, { in_app_enabled: true, email_enabled: true }];
for (const type of [...NOTIFICATION_TYPES, 'future-type']) {
  for (const board of channelRows) {
    for (const user of channelRows) {
      rows.set('board_notification_type_preferences', board);
      rows.set('notification_preferences', user);
      calls.length = 0;
      const effective = board ?? user;
      assert.deepEqual(await resolveNotificationChannels({ ...scope, type }), { inApp: effective?.in_app_enabled ?? true, email: effective?.email_enabled ?? true });
      assert.deepEqual(calls, [
        'board_notification_type_preferences', { ...filter, type }, ['in_app_enabled', 'email_enabled'], 'first',
        ...(board ? [] : ['notification_preferences', { user_id: scope.userId, type }, ['in_app_enabled', 'email_enabled'], 'first']),
      ]);
    }
  }
}
rows.clear();
for (const table of ['board_notification_preferences', 'board_members', 'board_guest_access']) {
  failingTable = table;
  await assert.rejects(resolveBoardNotificationPreference(scope), failure);
  await assert.rejects(boardPreferenceGuard(scope), failure);
}
for (const table of ['board_notification_type_preferences', 'notification_preferences']) {
  failingTable = table;
  await assert.rejects(resolveNotificationChannels({ ...scope, type: 'mention' }), failure);
}
console.info('real board preference guard: scope, defaults, precedence, channel combinations and rejection propagation verified');
