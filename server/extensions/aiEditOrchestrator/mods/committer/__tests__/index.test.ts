// Unit tests for committer module.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// [why] Bun global is not available in test environment — mock its file APIs.
// The committer uses Bun.file for existence checks and Bun.spawnSync for git commands.
const mockExists = vi.fn();
const mockBunFile = vi.fn();
const mockBunSpawnSync = vi.fn();
globalThis.Bun = {
  file: (...args: unknown[]) => mockBunFile(...args),
  write: vi.fn(),
  spawnSync: (...args: unknown[]) => mockBunSpawnSync(...args),
} as any;

describe('commit', () => {
  let commit: typeof import('../../committer').commit;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExists.mockResolvedValue(true);
    mockBunFile.mockReturnValue({ exists: () => mockExists() });
    // Default: git commands succeed
    mockBunSpawnSync.mockImplementation(({ cmd }: { cmd: string[] }) => {
      const cmdStr = cmd.join(' ');
      if (cmdStr.includes('rev-parse') && cmdStr.includes('HEAD')) {
        return { exitCode: 0, stdout: Buffer.from('abc123\n'), stderr: new Uint8Array() };
      }
      if (cmdStr.includes('rev-parse') && cmdStr.includes('show-toplevel')) {
        return { exitCode: 0, stdout: Buffer.from('/repo\n'), stderr: new Uint8Array() };
      }
      return { exitCode: 0, stdout: new Uint8Array(), stderr: new Uint8Array() };
    });
  });

  function setGitMocks(mocks: {
    addExitCode?: number;
    addStderr?: string;
    commitExitCode?: number;
    commitStderr?: string;
    pushExitCode?: number;
    pushStderr?: string;
    hashStdout?: string;
  }) {
    mockBunSpawnSync.mockImplementation(({ cmd }: { cmd: string[] }) => {
      const cmdStr = cmd.join(' ');
      if (cmdStr.startsWith('git add')) {
        return { exitCode: mocks.addExitCode ?? 0, stdout: new Uint8Array(), stderr: Buffer.from(mocks.addStderr ?? '') };
      }
      if (cmdStr.startsWith('git commit')) {
        return { exitCode: mocks.commitExitCode ?? 0, stdout: new Uint8Array(), stderr: Buffer.from(mocks.commitStderr ?? '') };
      }
      if (cmdStr.startsWith('git push')) {
        return { exitCode: mocks.pushExitCode ?? 0, stdout: new Uint8Array(), stderr: Buffer.from(mocks.pushStderr ?? '') };
      }
      if (cmdStr.includes('rev-parse') && cmdStr.includes('HEAD')) {
        return { exitCode: 0, stdout: Buffer.from(mocks.hashStdout ?? 'abc123\n'), stderr: new Uint8Array() };
      }
      if (cmdStr.includes('rev-parse') && cmdStr.includes('show-toplevel')) {
        return { exitCode: 0, stdout: Buffer.from('/repo\n'), stderr: new Uint8Array() };
      }
      return { exitCode: 0, stdout: new Uint8Array(), stderr: new Uint8Array() };
    });
  }

  it('returns 200 with empty result when no files', async () => {
    const { commit: cmt } = await import('../../committer');
    const result = await cmt({
      runId: 'run-1',
      cardId: 'card-abc',
      touchedFiles: [],
      message: 'test commit',
    });
    expect(result.status).toBe(200);
    expect(result.data?.commitHash).toBe('');
    expect(result.data?.files).toEqual([]);
  });

  it('successfully commits and pushes', async () => {
    setGitMocks({ hashStdout: 'def456\n' });
    const { commit: cmt } = await import('../../committer');
    const result = await cmt({
      runId: 'run-1',
      cardId: 'card-abc',
      touchedFiles: ['specs/request_changelog/test.md'],
      message: 'feat(ai-edit): test',
      push: true,
    });
    expect(result.status).toBe(200);
    expect(result.data?.commitHash).toBe('def456');
  });

  it('returns push-failed when push fails but commit succeeds', async () => {
    setGitMocks({
      pushExitCode: 1,
      pushStderr: 'connection refused',
      hashStdout: 'ghi789\n',
    });
    const { commit: cmt } = await import('../../committer');
    const result = await cmt({
      runId: 'run-1',
      cardId: 'card-abc',
      touchedFiles: ['specs/request_changelog/test.md'],
      message: 'feat(ai-edit): test',
      push: true,
    });
    expect(result.status).toBe(200);
    expect(result.name).toBe('push-failed');
    expect(result.data?.commitHash).toBe('ghi789');
  });
});
