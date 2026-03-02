// server/mods/pubsub/types.ts
// PubSubProvider interface for board-channel pub/sub.
export interface PubSubProvider {
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: (msg: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
}
