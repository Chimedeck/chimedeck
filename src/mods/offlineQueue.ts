// IndexedDB-backed offline mutation queue.
// WHY: the in-memory MessageQueue is lost on page reload, leaving the UI in a
// stale optimistic state. By persisting to IndexedDB we can survive browser
// refresh and replay pending mutations on next boot.
import { openDB, type IDBPDatabase } from 'idb';

export interface PendingMutation {
  id: string;            // client-assigned unique id (crypto.randomUUID())
  boardId: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  enqueuedAt: number;    // Date.now()
}

const DB_NAME = 'kanban-offline-queue';
const STORE = 'mutations';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          // keyPath = 'id' so each mutation is keyed by its client UUID
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/** Load all pending mutations from IndexedDB (called once on app boot). */
export const loadPersistedMutations = async (): Promise<PendingMutation[]> => {
  try {
    const db = await getDb();
    const all = await db.getAll(STORE) as PendingMutation[];
    // Return sorted by enqueuedAt to preserve original enqueue order
    return all.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  } catch (err) {
    // IndexedDB may be unavailable (private browsing, storage quota) — degrade silently
    console.warn('[offlineQueue] Failed to load persisted mutations:', err);
    return [];
  }
};

/** Persist a mutation to IndexedDB when it is enqueued. */
export const enqueueMutation = async (mutation: PendingMutation): Promise<void> => {
  try {
    const db = await getDb();
    await db.put(STORE, mutation);
  } catch (err) {
    console.warn('[offlineQueue] Failed to persist mutation:', err);
  }
};

/** Remove a mutation from IndexedDB once it has been acknowledged / replayed. */
export const acknowledgeMutation = async (id: string): Promise<void> => {
  try {
    const db = await getDb();
    await db.delete(STORE, id);
  } catch (err) {
    console.warn('[offlineQueue] Failed to remove acknowledged mutation:', err);
  }
};
