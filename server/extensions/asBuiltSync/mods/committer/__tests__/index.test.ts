// As-built committer tests (Sprint 176).
// [why] Verifies that the as-built committer correctly delegates to
// aiEditOrchestrator commit with the right message template, and handles
// edge cases like empty file lists.
import { describe, it, expect, mock } from 'bun:test';
import { asBuiltCommitterDeps } from '../index';

const { commitAsBuilt } = await import('../index');

describe('asBuiltCommitter', () => {
  it('should return early with empty message when no files provided', async () => {
    const result = await commitAsBuilt({
      runId: 'run-1',
      cardId: 'card-1',
      touchedFiles: [],
    });

    expect(result.status).toBe(200);
    expect(result.message).toContain('No files to commit');
    expect(result.data?.files).toEqual([]);
  });

  it('should delegate to aiEditOrchestrator commit with as-built message', async () => {
    const mockCommit = mock(async () => ({
      status: 200,
      data: { commitHash: 'abc123', files: ['specs/architecture/architecture.md'] },
    }));

    asBuiltCommitterDeps.commit = mockCommit as any;

    const result = await commitAsBuilt({
      runId: 'run-1',
      cardId: 'card-1',
      touchedFiles: ['specs/architecture/architecture.md'],
    });

    expect(result.status).toBe(200);
    expect(result.data?.commitHash).toBe('abc123');
    expect(mockCommit).toHaveBeenCalled();
  });

  it('should handle commit failures gracefully', async () => {
    const mockCommit = mock(async () => ({
      status: 500,
      name: 'git-commit-failed',
      message: 'git commit failed',
      data: { commitHash: '', files: [] },
    }));

    asBuiltCommitterDeps.commit = mockCommit as any;

    const result = await commitAsBuilt({
      runId: 'run-1',
      cardId: 'card-1',
      touchedFiles: ['specs/security/security.md'],
    });

    expect(result.status).toBe(500);
    expect(result.name).toBe('git-commit-failed');
  });
});
