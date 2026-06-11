// Unit tests for file editor.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockValidatePath = vi.fn();
const mockValidateFrontMatter = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockFileExists = vi.fn();

vi.mock('../../pathGuard', () => ({
  validatePath: (...args: unknown[]) => mockValidatePath(...args),
}));

vi.mock('../../frontMatterGuard', () => ({
  validateFrontMatter: (...args: unknown[]) => mockValidateFrontMatter(...args),
}));

// [why] Bun global is not available in test environment — mock its file APIs.
const mockBunFile = vi.fn();
const mockBunWrite = vi.fn();
globalThis.Bun = {
  file: (...args: unknown[]) => mockBunFile(...args),
  write: (...args: unknown[]) => mockBunWrite(...args),
  // minimal stub for spawnSync used in other modules
  spawnSync: vi.fn().mockReturnValue({ exitCode: 0, stdout: new Uint8Array(), stderr: new Uint8Array() }),
} as any;

describe('editFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file exists and has valid front-matter
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue('---\ntitle: Test\n---\n\n# Content');
    mockValidateFrontMatter.mockReturnValue({
      valid: true,
      parsed: { title: 'Test' },
      original: '---\ntitle: Test\n---',
    });
    mockBunFile.mockReturnValue({
      exists: () => mockFileExists(),
      text: () => mockReadFile(),
    });
    mockBunWrite.mockResolvedValue(undefined);
  });

  it('returns 403 when path is not allowed', async () => {
    mockValidatePath.mockReturnValue({
      allowed: false,
      normalisedPath: 'src/secret.ts',
      reason: 'Path outside allowed zones',
    });

    const { editFile } = await import('../../fileEditor');
    const result = await editFile({
      filePath: 'src/secret.ts',
      search: 'old',
      replace: 'new',
    });

    expect(result.status).toBe(403);
    expect(result.data?.applied).toBe(false);
  });

  it('returns 404 when file does not exist', async () => {
    mockValidatePath.mockReturnValue({
      allowed: true,
      normalisedPath: 'specs/request_changelog/missing.md',
    });
    mockFileExists.mockResolvedValue(false);

    const { editFile } = await import('../../fileEditor');
    const result = await editFile({
      filePath: 'specs/request_changelog/missing.md',
      search: 'old',
      replace: 'new',
    });

    expect(result.status).toBe(404);
    expect(result.name).toBe('file-not-found');
  });

  it('returns 422 for invalid front-matter', async () => {
    mockValidatePath.mockReturnValue({
      allowed: true,
      normalisedPath: 'specs/request_changelog/bad-fm.md',
    });
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue('---\nbad: "unclosed\n---');
    mockValidateFrontMatter.mockReturnValue({
      valid: false,
      original: '---\nbad: "unclosed\n---',
      reason: 'Failed to parse YAML front-matter',
    });

    const { editFile } = await import('../../fileEditor');
    const result = await editFile({
      filePath: 'specs/request_changelog/bad-fm.md',
      search: 'old',
      replace: 'new',
    });

    expect(result.status).toBe(422);
    expect(result.name).toBe('invalid-front-matter');
  });

  it('returns 200 on successful edit', async () => {
    const original = '---\ntitle: Test\ndate: 2026-06-10\nstatus: draft\n---\n\n# Old Content\nSome text here.';
    const edited = '---\ntitle: Test\ndate: 2026-06-10\nstatus: draft\n---\n\n# New Content\nUpdated text here.';

    mockValidatePath.mockReturnValue({
      allowed: true,
      normalisedPath: 'specs/request_changelog/editable.md',
    });
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue(original);
    mockValidateFrontMatter
      .mockReturnValueOnce({ valid: true, parsed: { title: 'Test', date: '2026-06-10', status: 'draft' }, original: '---\ntitle: Test\ndate: 2026-06-10\nstatus: draft\n---' })
      .mockReturnValueOnce({ valid: true, parsed: { title: 'Test', date: '2026-06-10', status: 'draft' }, original: '---\ntitle: Test\ndate: 2026-06-10\nstatus: draft\n---' });

    const { editFile } = await import('../../fileEditor');
    const result = await editFile({
      filePath: 'specs/request_changelog/editable.md',
      search: '# Old Content\nSome text here.',
      replace: '# New Content\nUpdated text here.',
    });

    expect(result.status).toBe(200);
    expect(result.data?.applied).toBe(true);
    // [why] The module uses Bun.write via fileEditorDeps, so mockBunWrite captures it
    expect(mockBunWrite).toHaveBeenCalledWith(
      'specs/request_changelog/editable.md',
      edited,
    );
  });

  it('returns 422 if edit would corrupt front-matter', async () => {
    const original = '---\ntitle: Test\ndate: 2026-06-10\nstatus: draft\n---\n\n# Content';

    mockValidatePath.mockReturnValue({
      allowed: true,
      normalisedPath: 'specs/request_changelog/editable.md',
    });
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue(original);
    // [why] First call validates original front-matter (passes), second
    // validates the post-edit content which now has broken front-matter.
    mockValidateFrontMatter
      .mockReturnValueOnce({ valid: true, parsed: { title: 'Test', date: '2026-06-10', status: 'draft' }, original: '---\ntitle: Test\ndate: 2026-06-10\nstatus: draft\n---' })
      .mockReturnValueOnce({ valid: false, reason: 'Missing required fields for request_changelog' });
    mockWriteFile.mockResolvedValue(undefined);

    const { editFile } = await import('../../fileEditor');
    // [why] Replace the closing --- delimiter with an unclosed quote to
    // corrupt the YAML front-matter in the edited content.
    const result = await editFile({
      filePath: 'specs/request_changelog/editable.md',
      search: '---\n\n# Content',
      replace: 'broken: "unclosed\n# Content',
    });

    expect(result.status).toBe(422);
    expect(result.name).toBe('edit-corrupts-front-matter');
  });
});
