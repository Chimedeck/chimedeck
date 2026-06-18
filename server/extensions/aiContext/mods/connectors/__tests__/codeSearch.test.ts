// Tests for codeSearch connector — code file scanning and scoring.
import { describe, it, expect } from 'vitest';
import { searchCode, type CodeFileSystem } from '../codeSearch';

describe('searchCode', () => {
  it('returns empty array when no code files match', async () => {
    const mockFS: CodeFileSystem = {
      async *globFiles() {
        // Empty
      },
      async readFile() {
        return null;
      },
    };

    const results = await searchCode({
      repoRoot: '/fake/repo',
      intent: 'nothing matching',
      fs: mockFS,
    });

    expect(results).toEqual([]);
  });

  it('finds code chunks matching intent keywords', async () => {
    const mockFS: CodeFileSystem = {
      async *globFiles() {
        yield 'server/extensions/auth/index.ts';
      },
      async readFile() {
        return {
          size: 1000,
          text: Array.from(
            { length: 15 },
            (_, i) =>
              `const auth = 'token';\nexport function authenticate(token) {\n  return validateToken(token);\n}\n`
          ).join('\n'),
        };
      },
    };

    const results = await searchCode({
      repoRoot: '/fake/repo',
      intent: 'authentication token validate',
      fs: mockFS,
    });

    // [why] Should find at least one chunk with auth-related keywords.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('code');
    expect(results[0].sourcePath).toBe('server/extensions/auth/index.ts');
  });

  it('excludes test files and node_modules', async () => {
    const mockFS: CodeFileSystem = {
      async *globFiles(_pattern, _cwd) {
        yield 'server/extensions/auth/__tests__/auth.test.ts';
        yield 'node_modules/foo/index.ts';
        yield 'server/extensions/auth/valid.ts';
      },
      async readFile() {
        return {
          size: 100,
          text: 'export const auth = true;\nconst auth2 = true;\nconst auth3 = true;\nconst auth4 = true;\nconst auth5 = true;\n',
        };
      },
    };

    const results = await searchCode({
      repoRoot: '/fake/repo',
      intent: 'auth',
      fs: mockFS,
    });

    // [why] Only valid.ts should produce results; __tests__ and node_modules excluded.
    const paths = results.map((r) => r.sourcePath);
    expect(paths.every((p) => !p.includes('__tests__') && !p.includes('node_modules'))).toBe(true);
  });
});
