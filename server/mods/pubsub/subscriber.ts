// server/mods/pubsub/subscriber.ts
// Subscribes to a board's pub/sub channel and forwards messages to the room registry.
import { pubsub } from './index';
import { broadcast } from '../../extensions/realtime/mods/rooms/broadcast';

export const subscriber = {
  async subscribeBoard(boardId: string): Promise<void> {
    await pubsub.subscribe(`board:${boardId}`, (message) => {
      broadcast({ boardId, message });
    });
  },

  async unsubscribeBoard(boardId: string): Promise<void> {
    await pubsub.unsubscribe(`board:${boardId}`);
  },
};
