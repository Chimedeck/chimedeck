// server/mods/pubsub/adapters/inMemory.ts
// In-process EventEmitter pub/sub adapter — single-node only (local dev).
import { EventEmitter } from 'events';
import type { PubSubProvider } from '../types';

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export class InMemoryPubSubAdapter implements PubSubProvider {
  async publish(channel: string, message: string): Promise<void> {
    emitter.emit(channel, message);
  }

  async subscribe(channel: string, handler: (msg: string) => void): Promise<void> {
    emitter.on(channel, handler);
  }

  async unsubscribe(channel: string): Promise<void> {
    emitter.removeAllListeners(channel);
  }
}
