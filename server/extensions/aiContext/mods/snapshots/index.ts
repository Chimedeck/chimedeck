// Context snapshot persistence — stores gather results for traceability.
// [why] Every gather call produces an immutable snapshot so later execution
// runs (Sprint 175 AI Edit Orchestrator) can reference exact inputs.

import { db } from '../../../../common/db';
import type { ContextGatherResponse, SnapshotRecord } from '../../types';

/** Interface for snapshot DB operations — injectable for tests. */
export interface SnapshotDB {
  insert: (snapshot: Omit<SnapshotRecord, 'id' | 'createdAt'>) => Promise<string>;
  findById: (id: string) => Promise<SnapshotRecord | undefined>;
  findByCardId: (cardId: string, limit?: number) => Promise<SnapshotRecord[]>;
}

/**
 * Compute a SHA-256 hash of stringified JSON for immutability.
 * [why] Bun implements Web Crypto, so SubtleCrypto is available natively.
 */
export async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a sortable CUID-like ID.
 * [why] Simple timestamp-based ID for snapshot records.
 */
function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `snap_${ts}_${rand}`;
}

export const liveSnapshotDB: SnapshotDB = {
  insert: async (snapshot) => {
    const id = generateId();
    await db('card_ai_context_snapshots').insert({
      id,
      card_id: snapshot.cardId,
      intent: snapshot.intent,
      snapshot_hash: snapshot.snapshotHash,
      total_chunks: snapshot.totalChunks,
      chunks_json: snapshot.chunksJson,
      budget_json: snapshot.budgetJson,
      focus_paths: snapshot.focusPaths ? JSON.stringify(snapshot.focusPaths) : null,
      created_at: db.fn.now(),
    });
    return id;
  },
  findById: async (id: string) => {
    const row = await db('card_ai_context_snapshots').select('*').where({ id }).first();
    if (!row) return undefined;
    return rowToSnapshot(row);
  },
  findByCardId: async (cardId: string, limit = 20) => {
    const rows = await db('card_ai_context_snapshots')
      .select('*')
      .where('card_id', cardId)
      .orderBy('created_at', 'desc')
      .limit(limit);
    return rows.map(rowToSnapshot);
  },
};

/** Map a raw DB row to a SnapshotRecord. */
function rowToSnapshot(row: Record<string, unknown>): SnapshotRecord {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    intent: row.intent as string,
    snapshotHash: row.snapshot_hash as string,
    totalChunks: row.total_chunks as number,
    chunksJson: row.chunks_json as string,
    budgetJson: row.budget_json as string,
    focusPaths: row.focus_paths ? (JSON.parse(row.focus_paths as string) as string[]) : undefined,
    createdAt: new Date(row.created_at as string),
  };
}

/**
 * Persist a gather result as an immutable snapshot.
 * Returns the snapshot ID for traceability.
 */
export async function persistSnapshot({
  cardId,
  intent,
  gatherResponse,
  focusPaths,
  db = liveSnapshotDB,
}: {
  cardId: string;
  intent: string;
  gatherResponse: ContextGatherResponse;
  focusPaths?: string[];
  db?: SnapshotDB;
}): Promise<{ snapshotId: string; snapshotHash: string }> {
  const chunksJson = JSON.stringify(gatherResponse.chunks);
  const snapshotHash = await computeHash(chunksJson);

  const snapshotId = await db.insert({
    cardId,
    intent,
    snapshotHash,
    totalChunks: gatherResponse.totalReturned,
    chunksJson,
    budgetJson: JSON.stringify(gatherResponse.budget ?? {}),
    focusPaths,
  });

  return { snapshotId, snapshotHash };
}

export const snapshotDeps = {
  persistSnapshot,
  computeHash,
};
