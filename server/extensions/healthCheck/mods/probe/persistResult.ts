// Persists a completed probe result into board_health_check_results.
// Returns the newly inserted row (camelCase) so callers can embed it in API responses.
import { randomUUID } from 'crypto';
import { db } from '../../../../common/db';
import type { ProbeResult } from './runProbe';

export interface PersistedProbeResult {
  id: string;
  healthCheckId: string;
  status: ProbeResult['status'];
  httpStatus: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

/**
 * INSERT a probe result row and return the persisted record.
 * Uses the checkedAt timestamp from the ProbeResult so the value
 * is consistent between what is returned to the caller and what is stored.
 */
export async function persistResult({
  healthCheckId,
  result,
}: {
  healthCheckId: string;
  result: ProbeResult;
}): Promise<PersistedProbeResult> {
  const id = randomUUID();

  await db('board_health_check_results').insert({
    id,
    health_check_id: healthCheckId,
    checked_at: result.checkedAt,
    status: result.status,
    http_status: result.httpStatus,
    response_time_ms: result.responseTimeMs,
    error_message: result.errorMessage,
  });

  return {
    id,
    healthCheckId,
    status: result.status,
    httpStatus: result.httpStatus,
    responseTimeMs: result.responseTimeMs,
    errorMessage: result.errorMessage,
    checkedAt: result.checkedAt,
  };
}
