// IndexedDB storage for user-private card drafts.
// WHY: we need local persistence so in-progress drafts survive page refreshes
// and remain available while offline. This store is always scoped to the
// (userId, workspaceId, cardId, draftType) composite key so no user can ever
// read another user's locally-stored draft.
import { openDB, type IDBPDatabase } from 'idb';

export type DraftType = 'description' | 'comment';
export type DraftIntent = 'editing' | 'save_pending' | 'submit_pending';

export interface LocalDraft {
  /** Composite key: `${userId}::${workspaceId}::${cardId}::${draftType}` */
  key: string;
  userId: string;
  workspaceId: string;
  cardId: string;
  draftType: DraftType;
  contentMarkdown: string;
  intent: DraftIntent;
  /** ISO-8601 timestamp set by the client when the draft was last modified. */
  updatedAt: string;
}

const DB_NAME = 'kanban-offline-drafts';
const STORE = 'drafts';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          // keyPath = 'key' so each draft is uniquely identified by its composite key
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          // [why] Index by userId to enable efficient per-user scans across cards
          store.createIndex('by_user', 'userId');
          // [why] Index by (userId, cardId) to list all drafts for a card fast
          store.createIndex('by_user_card', ['userId', 'cardId']);
        }
      },
    });
  }
  return dbPromise;
}

function buildKey(
  userId: string,
  workspaceId: string,
  cardId: string,
  draftType: DraftType,
): string {
  return `${userId}::${workspaceId}::${cardId}::${draftType}`;
}

/** Save (insert or replace) a draft in the local store. */
export async function saveDraft({
  userId,
  workspaceId,
  cardId,
  draftType,
  contentMarkdown,
  intent,
  updatedAt,
}: Omit<LocalDraft, 'key'>): Promise<LocalDraft> {
  const draft: LocalDraft = {
    key: buildKey(userId, workspaceId, cardId, draftType),
    userId,
    workspaceId,
    cardId,
    draftType,
    contentMarkdown,
    intent,
    updatedAt,
  };

  try {
    const db = await getDb();
    await db.put(STORE, draft);
  } catch (err) {
    // [why] IndexedDB may be unavailable (private browsing, storage quota exceeded) — degrade
    // gracefully so the UI continues working without local persistence.
    console.warn('[OfflineDrafts/storage] Failed to save draft:', err);
  }

  return draft;
}

/** Retrieve a single draft for a specific (userId, workspaceId, cardId, draftType). */
export async function getDraft({
  userId,
  workspaceId,
  cardId,
  draftType,
}: {
  userId: string;
  workspaceId: string;
  cardId: string;
  draftType: DraftType;
}): Promise<LocalDraft | null> {
  try {
    const db = await getDb();
    const result = (await db.get(STORE, buildKey(userId, workspaceId, cardId, draftType))) as
      | LocalDraft
      | undefined;
    return result ?? null;
  } catch (err) {
    console.warn('[OfflineDrafts/storage] Failed to get draft:', err);
    return null;
  }
}

/** List all local drafts for a given user on a specific card. */
export async function getDraftsByCard({
  userId,
  cardId,
}: {
  userId: string;
  cardId: string;
}): Promise<LocalDraft[]> {
  try {
    const db = await getDb();
    const results = (await db.getAllFromIndex(STORE, 'by_user_card', [userId, cardId])) as
      | LocalDraft[]
      | undefined;
    return results ?? [];
  } catch (err) {
    console.warn('[OfflineDrafts/storage] Failed to list drafts for card:', err);
    return [];
  }
}

/** Delete a local draft. No-op if the draft does not exist. */
export async function deleteDraft({
  userId,
  workspaceId,
  cardId,
  draftType,
}: {
  userId: string;
  workspaceId: string;
  cardId: string;
  draftType: DraftType;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, buildKey(userId, workspaceId, cardId, draftType));
  } catch (err) {
    console.warn('[OfflineDrafts/storage] Failed to delete draft:', err);
  }
}
