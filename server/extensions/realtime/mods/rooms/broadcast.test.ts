import { describe, it, expect } from 'bun:test';
import { rooms } from './index';
import { broadcast } from './broadcast';

describe('broadcast', () => {
  it('does nothing when room does not exist', () => {
    expect(() => broadcast({ boardId: 'nonexistent-board', message: 'test' })).not.toThrow();
  });

  it('sends message to sockets in room', () => {
    const sent: string[] = [];
    const fakeWs = {
      send: (msg: string) => sent.push(msg),
      data: { userId: 'u1', token: 't', subscribedBoards: new Set<string>() },
    } as any;

    rooms.set('test-board', new Set([fakeWs]));
    broadcast({ boardId: 'test-board', message: 'hello' });
    rooms.delete('test-board');

    expect(sent).toEqual(['hello']);
  });
});
