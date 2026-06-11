// [why] Shared mock factory for persistence module — prevents cross-file
// mock.module collisions in Bun. ALL test files must use the same mock
// functions so that regardless of which registration "wins", the mock
// exports are consistent.
import { mock } from 'bun:test';
import { sharedMockDb } from './mockDb';

export const mockCreateSprintGenRun = mock(async () => ({
  id: 'run-1',
  card_id: 'card-1',
  workspace_id: 'ws-1',
  created_by: 'user-1',
  status: 'QUEUED' as const,
  tier: 'tier_3',
  snapshot_id: null,
  trigger_run_id: null,
  output_files: null,
  requirement_packet: null,
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: null,
}));

export const mockHasSucceededRun = mock(async () => false);
export const mockCreateGeneratedSprintCard = mock(async () => {});
export const mockGetGeneratedSprintCards = mock(async () => []);
export const mockGetSprintGenRun = mock(async () => null);
export const mockUpdateSprintGenRunStatus = mock(async () => null);

export const persistenceMockModule = () => ({
  createSprintGenRun: mockCreateSprintGenRun,
  hasSucceededRun: mockHasSucceededRun,
  createGeneratedSprintCard: mockCreateGeneratedSprintCard,
  getGeneratedSprintCards: mockGetGeneratedSprintCards,
  getSprintGenRun: mockGetSprintGenRun,
  updateSprintGenRunStatus: mockUpdateSprintGenRunStatus,
  persistenceDeps: { db: sharedMockDb },
});
