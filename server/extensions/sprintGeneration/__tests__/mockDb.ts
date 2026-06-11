// [why] Shared mock DB factory for sprintGeneration tests.
// Bun's mock.module is process-global — the last registration wins.
// ALL test files must provide a consistent mock for common/db, sharing
// the same chain object so resetting works regardless of which registration "won".
import { mock } from 'bun:test';

export const sharedMockFirst = mock();
export const sharedMockInsert = mock().mockImplementation(() => sharedMockChain);

export const sharedMockChain: Record<string, any> = {
  where: mock(() => sharedMockChain),
  whereRaw: mock(() => sharedMockChain),
  orderBy: mock(() => sharedMockChain),
  select: mock(() => sharedMockChain),
  join: mock(() => sharedMockChain),
  first: sharedMockFirst,
  insert: sharedMockInsert,
};

export const sharedMockDb = mock((_tableName: string) => sharedMockChain);

/** Reset all mock state and optionally queue first() results. */
export function resetMockDb(...firstResults: any[]) {
  sharedMockFirst.mockReset();
  sharedMockInsert.mockReset();
  for (const result of firstResults) {
    sharedMockFirst.mockResolvedValueOnce(result);
  }
}
