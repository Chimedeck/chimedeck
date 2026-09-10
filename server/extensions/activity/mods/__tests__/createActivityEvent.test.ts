import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { WriteActivityInput } from '../write';

const writeActivityMock = mock(async (input: WriteActivityInput) => ({
  id: 'activity-1',
  action: input.action,
  actor_id: input.actorId,
  payload: input.payload,
  created_at: new Date().toISOString(),
}));

const publishCardActivityEventMock = mock(() => Promise.resolve());
const mapActivityToNotificationMock = mock(() => Promise.resolve());
const getActiveWebhooksForEventMock = mock(async () => []);
const dispatchWebhookMock = mock(() => Promise.resolve());

await mock.module('../write', () => ({
  writeActivity: writeActivityMock,
}));

await mock.module('../../events/publishCardActivityEvent', () => ({
  publishCardActivityEvent: publishCardActivityEventMock,
}));

await mock.module('../mapActivityToNotification', () => ({
  mapActivityToNotification: mapActivityToNotificationMock,
}));

await mock.module('../../../common/db', () => ({
  db: mock(() => ({})),
}));

await mock.module('../../../config/env', () => ({
  env: { WEBHOOKS_ENABLED: false },
}));

await mock.module('../../webhooks/mods/registry', () => ({
  getActiveWebhooksForEvent: getActiveWebhooksForEventMock,
}));

await mock.module('../../webhooks/mods/dispatch', () => ({
  dispatchWebhook: dispatchWebhookMock,
}));

const { emitCardCreated, emitCardMoved, emitCardMemberAssigned } = await import('../createActivityEvent');

beforeEach(() => {
  writeActivityMock.mockClear();
  publishCardActivityEventMock.mockClear();
  mapActivityToNotificationMock.mockClear();
  getActiveWebhooksForEventMock.mockClear();
  dispatchWebhookMock.mockClear();
});

describe('createActivityEvent notification fan-out', () => {
  test('emitCardCreated does not map activity to notification directly', async () => {
    await emitCardCreated({
      actorId: 'actor-1',
      cardId: 'card-1',
      cardTitle: 'Card title',
      listId: 'list-1',
      listName: 'To do',
      boardId: 'board-1',
      workspaceId: 'workspace-1',
    });

    expect(writeActivityMock).toHaveBeenCalledTimes(1);
    expect(publishCardActivityEventMock).toHaveBeenCalledTimes(1);
    expect(mapActivityToNotificationMock).not.toHaveBeenCalled();
  });

  test('emitCardMoved does not map activity to notification directly', async () => {
    await emitCardMoved({
      actorId: 'actor-1',
      cardId: 'card-1',
      cardTitle: 'Card title',
      fromListId: 'list-1',
      fromListName: 'To do',
      toListId: 'list-2',
      toListName: 'Done',
      boardId: 'board-1',
      workspaceId: 'workspace-1',
    });

    expect(writeActivityMock).toHaveBeenCalledTimes(1);
    expect(publishCardActivityEventMock).toHaveBeenCalledTimes(1);
    expect(mapActivityToNotificationMock).not.toHaveBeenCalled();
  });

  test('emitCardMoved returns null for same-list reorder and emits nothing', async () => {
    const result = await emitCardMoved({
      actorId: 'actor-1',
      cardId: 'card-1',
      cardTitle: 'Card title',
      fromListId: 'list-1',
      fromListName: 'To do',
      toListId: 'list-1',
      toListName: 'To do',
      boardId: 'board-1',
      workspaceId: 'workspace-1',
    });

    expect(result).toBeNull();
    expect(writeActivityMock).not.toHaveBeenCalled();
    expect(publishCardActivityEventMock).not.toHaveBeenCalled();
    expect(mapActivityToNotificationMock).not.toHaveBeenCalled();
  });

  test('emitCardMemberAssigned still maps activity to notification', async () => {
    await emitCardMemberAssigned({
      actorId: 'actor-1',
      cardId: 'card-1',
      cardTitle: 'Card title',
      userId: 'user-2',
      assigneeName: 'Bob',
      boardId: 'board-1',
      workspaceId: 'workspace-1',
    });

    expect(writeActivityMock).toHaveBeenCalledTimes(1);
    expect(publishCardActivityEventMock).toHaveBeenCalledTimes(1);
    expect(mapActivityToNotificationMock).toHaveBeenCalledTimes(1);
  });
});
