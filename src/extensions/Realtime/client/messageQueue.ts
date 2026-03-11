// In-memory mutation queue for offline/disconnected state.
// Mutations are enqueued when the WS is down and replayed on reconnect.
//
// WHY: per spec §6 Reliability — "queued mutations are replayed in order
// after reconnect; if any returns 409/422 discard + notify user".
// Max queue size is 100; exceeding it triggers a full board reload.
//
// IndexedDB persistence is handled via src/mods/offlineQueue.ts so that
// pending mutations survive a full page reload.
import { enqueueMutation as persistMutation, acknowledgeMutation } from '../../../mods/offlineQueue';

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
    // Persist asynchronously — fire-and-forget; failures are logged in offlineQueue
    void persistMutation(mutation);
    return true;
  }

  peek(): QueuedMutation | undefined {
    return this.queue[0];
  }

  dequeue(): QueuedMutation | undefined {
    const mutation = this.queue.shift();
    if (mutation) {
      // Remove from IndexedDB — fire-and-forget
      void acknowledgeMutation(mutation.id);
    }
    return mutation;
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

  /**
   * Hydrate the in-memory queue from a list of persisted mutations.
   * Called once on app boot after loadPersistedMutations() resolves.
   * Only adds mutations that are not already present (by id) to avoid duplicates.
   */
  hydrate(mutations: QueuedMutation[]) {
    const existingIds = new Set(this.queue.map((m) => m.id));
    for (const m of mutations) {
      if (!existingIds.has(m.id)) {
        this.queue.push(m);
      }
    }
  }
}

// Module-level singleton shared between wsMiddleware and useWebSocket
export const messageQueue = new MessageQueue();
