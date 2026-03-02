// server/mods/pubsub/adapters/redis.ts
// Redis pub/sub adapter using ioredis. Uses separate pub/sub clients as required by Redis.
import Redis from 'ioredis';
import type { PubSubProvider } from '../types';

export class RedisPubSubAdapter implements PubSubProvider {
  private pub: Redis;
  private sub: Redis;
  private handlers = new Map<string, (msg: string) => void>();

  constructor(redisUrl: string) {
    this.pub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
    this.sub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });

    this.sub.on('message', (channel: string, message: string) => {
      const handler = this.handlers.get(channel);
      if (handler) handler(message);
    });
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.pub.publish(channel, message);
  }

  async subscribe(channel: string, handler: (msg: string) => void): Promise<void> {
    this.handlers.set(channel, handler);
    await this.sub.subscribe(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.sub.unsubscribe(channel);
  }
}
