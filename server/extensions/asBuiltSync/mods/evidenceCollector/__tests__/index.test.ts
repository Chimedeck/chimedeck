// Evidence collector tests (Sprint 176).
// [why] Verifies that evidence collection works correctly with mocked git
// commands and DB queries. Tests cover PR ref collection, changed file
// detection, test evidence scanning, and graceful error handling.
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { evidenceCollectorDeps } from '../index';

// Import the main function but override deps for testing
const { collectEvidence } = await import('../index');

describe('evidenceCollector', () => {
  let mockExec: ReturnType<
    typeof mock<
      (cmd: string[], cwd?: string) => { stdout: string; stderr: string; exitCode: number }
    >
  >;
  let mockGetRepoRoot: ReturnType<typeof mock<() => string>>;
  let mockDbTable: ReturnType<typeof mock<() => any>>;
  let originalExec: typeof evidenceCollectorDeps.exec;
  let originalGetRepoRoot: typeof evidenceCollectorDeps.getRepoRoot;
  let originalDb: typeof evidenceCollectorDeps.db;

  beforeEach(() => {
    originalExec = evidenceCollectorDeps.exec;
    originalGetRepoRoot = evidenceCollectorDeps.getRepoRoot;
    originalDb = evidenceCollectorDeps.db;

    mockExec = mock(() => ({ stdout: '', stderr: '', exitCode: 0 }));
    mockGetRepoRoot = mock(() => '/fake/repo');
    evidenceCollectorDeps.exec = mockExec as any;
    evidenceCollectorDeps.getRepoRoot = mockGetRepoRoot;

    // Mock the DB with a chainable query builder
    const mockChain = {
      join: mock(() => mockChain),
      where: mock(() => mockChain),
      select: mock(() => mockChain),
      first: mock(() =>
        Promise.resolve({
          id: 'card-1',
          title: 'Test Card',
          description: 'Test description',
          list_id: 'list-1',
          list_name: 'In Progress',
          board_id: 'board-1',
        })
      ),
    };
    mockDbTable = mock(() => mockChain);
    evidenceCollectorDeps.db = mockDbTable as any;
  });

  it('should return error when not in a git repo', async () => {
    evidenceCollectorDeps.getRepoRoot = mock(() => {
      throw new Error('Not in a git repository');
    });

    const result = await collectEvidence({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
    });

    expect(result.status).toBe(500);
    expect(result.name).toBe('git-repo-not-found');
  });

  it('should collect merged PRs from git log', async () => {
    const mockLogOutput =
      'abc123|Merge pull request #42 from feature/foo|2026-06-10T10:00:00Z|def456 abc123\n' +
      'ghi789|Merge pull request #99 from fix/bar|2026-06-09T09:00:00Z|jkl012 ghi789\n';

    const callResults: any[] = [
      // git log call
      { stdout: mockLogOutput, stderr: '', exitCode: 0 },
      // git diff call
      { stdout: '', stderr: '', exitCode: 0 },
    ];
    let callIndex = 0;
    evidenceCollectorDeps.exec = mock(async () => {
      return callResults[callIndex++] || { stdout: '', stderr: '', exitCode: 0 };
    }) as any;

    const result = await collectEvidence({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
    });

    expect(result.status).toBe(200);
    expect(result.data?.evidence.mergedPrs).toHaveLength(2);
    expect(result.data?.evidence.mergedPrs[0].prNumber).toBe('42');
    expect(result.data?.evidence.mergedPrs[1].prNumber).toBe('99');
  });

  it('should collect changed files from git diff', async () => {
    const mockDiffOutput =
      'A\tspecs/sprints/sprint-177.md\nM\tspecs/architecture/architecture.md\nD\tsrc/old-component.tsx\n';

    const callResults: any[] = [
      // git log call — empty
      { stdout: '', stderr: '', exitCode: 0 },
      // git diff call
      { stdout: mockDiffOutput, stderr: '', exitCode: 0 },
    ];
    let callIndex = 0;
    evidenceCollectorDeps.exec = mock(async () => {
      return callResults[callIndex++] || { stdout: '', stderr: '', exitCode: 0 };
    }) as any;

    const result = await collectEvidence({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
    });

    expect(result.status).toBe(200);
    expect(result.data?.evidence.changedFiles).toHaveLength(3);
    expect(result.data?.evidence.changedFiles[0].status).toBe('added');
    expect(result.data?.evidence.changedFiles[1].status).toBe('modified');
    expect(result.data?.evidence.changedFiles[2].status).toBe('deleted');
  });

  it('should detect test evidence from changed files', async () => {
    const mockDiffOutput =
      'A\tserver/extensions/sprintGeneration/__tests__/index.test.ts\n' +
      'M\tsrc/components/Button.spec.tsx\n' +
      'M\tsrc/components/Normal.tsx\n';

    const callResults: any[] = [
      { stdout: '', stderr: '', exitCode: 0 },
      { stdout: mockDiffOutput, stderr: '', exitCode: 0 },
    ];
    let callIndex = 0;
    evidenceCollectorDeps.exec = mock(async () => {
      return callResults[callIndex++] || { stdout: '', stderr: '', exitCode: 0 };
    }) as any;

    const result = await collectEvidence({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
    });

    expect(result.status).toBe(200);
    // Two test files should be detected
    expect(result.data?.evidence.testEvidence).toHaveLength(2);
    expect(result.data?.evidence.testEvidence[0].testFile).toContain('__tests__');
    expect(result.data?.evidence.testEvidence[1].testFile).toContain('.spec.');
  });

  it('should return empty arrays when no changes exist', async () => {
    const callResults: any[] = [
      { stdout: '', stderr: '', exitCode: 0 },
      { stdout: '', stderr: '', exitCode: 0 },
    ];
    let callIndex = 0;
    evidenceCollectorDeps.exec = mock(async () => {
      return callResults[callIndex++] || { stdout: '', stderr: '', exitCode: 0 };
    }) as any;

    const result = await collectEvidence({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
    });

    expect(result.status).toBe(200);
    expect(result.data?.evidence.mergedPrs).toEqual([]);
    expect(result.data?.evidence.changedFiles).toEqual([]);
    expect(result.data?.evidence.testEvidence).toEqual([]);
  });

  it('should collect card metadata from DB', async () => {
    const result = await collectEvidence({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
    });

    expect(result.status).toBe(200);
    expect(result.data?.evidence.cardMetadata.title).toBe('Test Card');
    expect(result.data?.evidence.cardMetadata.phase).toBe('In Progress');
  });

  it('should handle DB failure gracefully for card metadata', async () => {
    const mockChain = {
      join: mock(() => mockChain),
      where: mock(() => mockChain),
      select: mock(() => mockChain),
      first: mock(() => Promise.reject(new Error('DB connection failed'))),
    };
    evidenceCollectorDeps.db = mock(() => mockChain) as any;

    const result = await collectEvidence({
      cardId: 'card-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
    });

    // Should still return 200 with empty card metadata
    expect(result.status).toBe(200);
    expect(result.data?.evidence.cardMetadata.title).toBe('');
  });
});
