// In-memory mutation queue for offline/disconnected state.
// Mutations are enqueued when the WS is down and replayed on reconnect.
//
// WHY: per spec §6 Reliability — "queued mutations are replayed in order
// after reconnect; if any returns 409/422 discard + notify user".
// Max queue size is 100; exceeding it triggers a full board reload.

export const MAX_QUEUE_SIZE = 100;

export interface QueuedMutation {
  id: string; // client-assigned unique id (e.g. crypto.randomUUID())
  boardId: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  enqueuedAt: number; // Date.now()
}

type OnOverflow = (boardId: string) => void;

class MessageQueue {
  private queue: QueuedMutation[] = [];
  private onOverflow: OnOverflow | null = null;

  // ---------- Public API ----------

  setOverflowHandler(handler: OnOverflow) {
    this.onOverflow = handler;
  }

  enqueue(mutation: QueuedMutation): boolean {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Clear and signal overflow so callers can do a full board reload
      this.clear();
      this.onOverflow?.(mutation.boardId);
      return false;
    }
    this.queue.push(mutation);
    return true;
  }

  peek(): QueuedMutation | undefined {
    return this.queue[0];
  }

  dequeue(): QueuedMutation | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
  }

  /** Return a snapshot of all queued mutations (for inspection/testing) */
  getAll(): readonly QueuedMutation[] {
    return this.queue;
  }
}

// Module-level singleton shared between wsMiddleware and useWebSocket
export const messageQueue = new MessageQueue();
