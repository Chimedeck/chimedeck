// Tests for docsSearch connector — spec file chunking and scoring.
import { describe, it, expect } from 'vitest';
import { searchDocs, type DocsFileSystem } from '../docsSearch';

describe('searchDocs', () => {
  it('returns empty array when no spec files exist', async () => {
    const mockFS: DocsFileSystem = {
      async *globFiles() {
        // Empty — no files to scan
      },
      async readFile() {
        return null;
      },
    };

    const results = await searchDocs({
      repoRoot: '/fake/repo',
      intent: 'build authentication system',
      fs: mockFS,
    });

    expect(results).toEqual([]);
  });

  it('chunks by headings and scores against intent', async () => {
    const mockFS: DocsFileSystem = {
      async *globFiles() {
        yield 'specs/architecture/requirements.md';
      },
      async readFile() {
        return {
          size: 500,
          text: '# Authentication System\nThis system must handle user login.\n\n## Security\nAll passwords shall be hashed.\nGiven a user, when login, then return token.',
        };
      },
    };

    const results = await searchDocs({
      repoRoot: '/fake/repo',
      intent: 'authentication security login',
      fs: mockFS,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('docs');
    expect(results[0].sourcePath).toBe('specs/architecture/requirements.md');
    // [why] At least one chunk should match "authentication"
    const hasAuthMatch = results.some((r) => r.content.toLowerCase().includes('authentication'));
    expect(hasAuthMatch).toBe(true);
  });

  it('handles unreadable files gracefully', async () => {
    const mockFS: DocsFileSystem = {
      async *globFiles() {
        yield 'specs/missing.md';
      },
      async readFile() {
        // [why] Simulate ENOENT by returning null
        return null;
      },
    };

    const results = await searchDocs({
      repoRoot: '/fake/repo',
      intent: 'anything',
      fs: mockFS,
    });

    // [why] Missing files should be silently skipped, not crash.
    expect(results).toEqual([]);
  });

  it('skips chunks below minimum relevance threshold', async () => {
    const mockFS: DocsFileSystem = {
      async *globFiles() {
        yield 'specs/unrelated.md';
      },
      async readFile() {
        return {
          size: 200,
          text: '# Completely Unrelated\nThis doc is about giraffe feeding schedules.',
        };
      },
    };

    const results = await searchDocs({
      repoRoot: '/fake/repo',
      intent: 'authentication system',
      fs: mockFS,
    });

    // [why] No chunk should exceed the 0.1 relevance threshold.
    expect(results).toEqual([]);
  });
});
