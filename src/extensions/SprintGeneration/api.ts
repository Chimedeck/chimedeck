// Client API helpers for sprint generation and as-built sync (Sprint 176).
// Follows the CardChat/api.ts and BoardChat/api.ts patterns:
// destructured { api, cardId, ... } args.
import type { BoardChatMessage } from '../BoardChat/api';

export interface SprintGenerationRun {
  id: string;
  card_id: string;
  workspace_id: string;
  created_by: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  tier: string | null;
  snapshot_id: string | null;
  trigger_run_id: string | null;
  output_files: string[] | null;
  requirement_packet: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AsBuiltSyncRun {
  id: string;
  card_id: string;
  workspace_id: string;
  created_by: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  trigger_run_id: string | null;
  evidence: AsBuiltEvidence | null;
  output_files: string[] | null;
  commit_hash: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AsBuiltEvidence {
  mergedPrs: Array<{
    prNumber: string;
    prTitle: string;
    mergedAt: string;
    branchName: string;
  }>;
  changedFiles: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
  }>;
  testEvidence: Array<{
    testFile: string;
    testCount: number;
    passingCount: number;
    failingCount: number;
  }>;
  cardMetadata: {
    title: string;
    description: string;
    phase: string;
    boardId: string;
    listId: string;
  };
}

export interface GenerateSprintRequest {
  snapshotId?: string;
  boardId?: string;
}

export interface GenerateSprintResponse {
  data: {
    run: SprintGenerationRun;
  };
}

export interface AsBuiltSyncResponse {
  data: {
    run: AsBuiltSyncRun;
  };
}

// ── Sprint Generation ──

/**
 * Trigger sprint generation for a card.
 * POST /api/v1/cards/:cardId/sprint/generate
 */
export async function generateSprint({
  api,
  cardId,
  body,
}: {
  api: { post: <T>(url: string, data?: unknown) => Promise<T> };
  cardId: string;
  body?: GenerateSprintRequest;
}): Promise<GenerateSprintResponse> {
  return api.post<GenerateSprintResponse>(
    `/cards/${cardId}/sprint/generate`,
    body ?? {},
  );
}

// ── As-Built Sync ──

/**
 * Trigger as-built sync for a card.
 * POST /api/v1/cards/:cardId/as-built/sync
 */
export async function syncAsBuilt({
  api,
  cardId,
}: {
  api: { post: <T>(url: string, data?: unknown) => Promise<T> };
  cardId: string;
}): Promise<AsBuiltSyncResponse> {
  return api.post<AsBuiltSyncResponse>(`/cards/${cardId}/as-built/sync`);
}

// ── Run Status ──

export interface GetSprintGenRunResponse {
  data: SprintGenerationRun;
}

/**
 * Get the status of a sprint generation run.
 * GET /api/v1/sprint-generation/runs/:runId
 */
export async function getSprintGenRun({
  api,
  runId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  runId: string;
}): Promise<GetSprintGenRunResponse> {
  return api.get<GetSprintGenRunResponse>(`/sprint-generation/runs/${runId}`);
}

export interface GetAsBuiltRunResponse {
  data: AsBuiltSyncRun;
}

/**
 * Get the status of an as-built sync run.
 * GET /api/v1/as-built/runs/:runId
 */
export async function getAsBuiltRun({
  api,
  runId,
}: {
  api: { get: <T>(url: string) => Promise<T> };
  runId: string;
}): Promise<GetAsBuiltRunResponse> {
  return api.get<GetAsBuiltRunResponse>(`/as-built/runs/${runId}`);
}
