// Unit tests for file creator.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockValidatePath = vi.fn();
const mockWriteFile = vi.fn();
const mockFileExists = vi.fn();

vi.mock('../../pathGuard', () => ({
  validatePath: (...args: unknown[]) => mockValidatePath(...args),
  pathGuardDeps: {},
}));

// [why] Bun global is not available in test environment — mock its file APIs.
const mockBunFile = vi.fn();
const mockBunWrite = vi.fn();
const mockBunSpawnSync = vi.fn();
globalThis.Bun = {
  file: (...args: unknown[]) => mockBunFile(...args),
  write: (...args: unknown[]) => mockBunWrite(...args),
  spawnSync: (...args: unknown[]) => mockBunSpawnSync(...args),
} as any;

describe('createFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBunFile.mockReturnValue({
      exists: () => Promise.resolve(mockFileExists()),
    });
    mockBunWrite.mockResolvedValue(undefined);
    mockBunSpawnSync.mockReturnValue({
      exitCode: 0,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    });
  });

  it('returns 403 when path is not allowed', async () => {
    mockValidatePath.mockReturnValue({
      allowed: false,
      normalisedPath: 'src/test.ts',
      reason: 'Path outside allowed zones',
    });

    const { createFile } = await import('../../fileCreator');
    const result = await createFile({
      filePath: 'src/test.ts',
      content: 'test content',
    });

    expect(result.status).toBe(403);
    expect(result.name).toBe('path-not-allowed');
    expect(result.data?.created).toBe(false);
  });

  it('returns 409 when file already exists', async () => {
    mockValidatePath.mockReturnValue({
      allowed: true,
      normalisedPath: 'specs/request_changelog/existing.md',
    });
    mockFileExists.mockResolvedValue(true);

    const { createFile } = await import('../../fileCreator');
    const result = await createFile({
      filePath: 'specs/request_changelog/existing.md',
      content: 'new',
    });

    expect(result.status).toBe(409);
    expect(result.name).toBe('file-already-exists');
  });

  it('returns 201 on successful creation', async () => {
    mockValidatePath.mockReturnValue({
      allowed: true,
      normalisedPath: 'specs/request_changelog/new-file.md',
    });
    mockFileExists.mockResolvedValue(false);
    mockWriteFile.mockResolvedValue(undefined);
    mockBunWrite.mockResolvedValue(undefined);

    const { createFile } = await import('../../fileCreator');
    const result = await createFile({
      filePath: 'specs/request_changelog/new-file.md',
      content: '# New File\n\nContent here.',
    });

    expect(result.status).toBe(201);
    expect(result.data?.created).toBe(true);
  });
});
