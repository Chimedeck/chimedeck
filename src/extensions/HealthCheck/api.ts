// API client for all Health Check endpoints.
// All functions accept an injected `api` (axios instance) so they are testable
// without importing the real client (avoids circular deps).

// ---------- Shared types ----------

export type HealthCheckStatus = 'green' | 'amber' | 'red' | 'unknown';
export type HealthCheckType = 'custom' | 'preset';

export interface HealthCheckResult {
  status: HealthCheckStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface HealthCheck {
  id: string;
  boardId: string;
  name: string;
  url: string;
  type: HealthCheckType;
  presetKey: string | null;
  expectedStatus: number | null;
  isActive: boolean;
  createdAt: string;
  latestResult: HealthCheckResult | null;
}

export interface ProbeResult {
  id: string;
  healthCheckId: string;
  status: HealthCheckStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface HealthCheckPreset {
  key: string;
  name: string;
  description: string;
  url: string;
  category: string;
  expectedStatus?: number | null;
}

// ---------- API client type ----------

type ApiClient = {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, data?: unknown) => Promise<T>;
  delete: <T>(url: string) => Promise<T>;
};

// ---------- Endpoints ----------

/**
 * GET /api/v1/health-check/presets
 * Returns the pre-configured service preset list.
 */
export async function fetchPresets({
  api,
}: {
  api: ApiClient;
}): Promise<{ data: HealthCheckPreset[] }> {
  return api.get<{ data: HealthCheckPreset[] }>('/health-check/presets');
}

/**
 * GET /api/v1/boards/:boardId/health-checks
 * Returns all active health checks for a board, each with latestResult embedded.
 */
export async function fetchHealthChecks({
  api,
  boardId,
}: {
  api: ApiClient;
  boardId: string;
}): Promise<{ data: HealthCheck[] }> {
  return api.get<{ data: HealthCheck[] }>(`/boards/${boardId}/health-checks`);
}

/**
 * POST /api/v1/boards/:boardId/health-checks
 * Adds a new health check entry to the board.
 */
export async function addHealthCheck({
  api,
  boardId,
  name,
  url,
  type,
  presetKey,
  expectedStatus,
}: {
  api: ApiClient;
  boardId: string;
  name: string;
  url: string;
  type: HealthCheckType;
  presetKey?: string;
  expectedStatus?: number | null;
}): Promise<{ data: HealthCheck }> {
  return api.post<{ data: HealthCheck }>(`/boards/${boardId}/health-checks`, {
    name,
    url,
    type,
    presetKey,
    expectedStatus,
  });
}

/**
 * DELETE /api/v1/boards/:boardId/health-checks/:id
 * Soft-deletes (deactivates) a health check entry.
 */
export async function removeHealthCheck({
  api,
  boardId,
  healthCheckId,
}: {
  api: ApiClient;
  boardId: string;
  healthCheckId: string;
}): Promise<void> {
  return api.delete(`/boards/${boardId}/health-checks/${healthCheckId}`);
}

/**
 * POST /api/v1/boards/:boardId/health-checks/:id/probe
 * Runs an on-demand probe for a single health check entry.
 */
export async function probeHealthCheck({
  api,
  boardId,
  healthCheckId,
}: {
  api: ApiClient;
  boardId: string;
  healthCheckId: string;
}): Promise<{ data: ProbeResult }> {
  return api.post<{ data: ProbeResult }>(
    `/boards/${boardId}/health-checks/${healthCheckId}/probe`,
  );
}

/**
 * POST /api/v1/boards/:boardId/health-checks/probe-all
 * Runs on-demand probes for all health checks on the board.
 */
export async function probeAllHealthChecks({
  api,
  boardId,
}: {
  api: ApiClient;
  boardId: string;
}): Promise<{ data: ProbeResult[] }> {
  return api.post<{ data: ProbeResult[] }>(`/boards/${boardId}/health-checks/probe-all`);
}
