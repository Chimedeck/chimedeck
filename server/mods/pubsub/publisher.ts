// server/mods/pubsub/publisher.ts
// Thin wrapper: publishes a serialised event to the board's pub/sub channel.
import { pubsub } from './index';

export const publisher = {
  async publish(boardId: string, message: string): Promise<void> {
    await pubsub.publish(`board:${boardId}`, message);
  },
};
