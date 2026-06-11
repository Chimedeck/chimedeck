// Unit tests for path guard module.
import { describe, it, expect } from 'vitest';
import { validatePath } from '../index';

describe('validatePath', () => {
  it('allows paths within allowed zones', () => {
    const result = validatePath({ filePath: 'specs/request_changelog/test.md' });
    expect(result.allowed).toBe(true);
    expect(result.normalisedPath).toBe('specs/request_changelog/test.md');
  });

  it('allows sprints paths', () => {
    const result = validatePath({ filePath: 'specs/sprints/sprint-175.md' });
    expect(result.allowed).toBe(true);
  });

  it('allows architecture paths', () => {
    const result = validatePath({ filePath: 'specs/architecture/test.md' });
    expect(result.allowed).toBe(true);
  });

  it('allows security paths', () => {
    const result = validatePath({ filePath: 'specs/security/test.md' });
    expect(result.allowed).toBe(true);
  });

  it('rejects paths outside allowed zones', () => {
    const result = validatePath({ filePath: 'src/components/Test.tsx' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('outside allowed write zones');
  });

  it('rejects path traversal attempts', () => {
    const result = validatePath({ filePath: '../../etc/passwd' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Path traversal');
  });

  it('rejects .git paths', () => {
    const result = validatePath({ filePath: '.git/config' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('disallowed prefix');
  });

  it('rejects node_modules paths', () => {
    const result = validatePath({ filePath: 'specs/node_modules/package.json' });
    expect(result.allowed).toBe(false);
  });

  it('rejects empty paths', () => {
    const result = validatePath({ filePath: '' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Empty file path');
  });

  it('rejects whitespace-only paths', () => {
    const result = validatePath({ filePath: '   ' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Empty file path');
  });

  it('normalises paths with leading slash', () => {
    const result = validatePath({ filePath: '/specs/request_changelog/test.md' });
    expect(result.allowed).toBe(true);
    expect(result.normalisedPath).toBe('specs/request_changelog/test.md');
  });

  it('normalises paths with trailing slash', () => {
    const result = validatePath({ filePath: 'specs/sprints/' });
    expect(result.allowed).toBe(true);
    expect(result.normalisedPath).toBe('specs/sprints');
  });

  it('resolves single-dot segments', () => {
    const result = validatePath({ filePath: 'specs/./sprints/test.md' });
    expect(result.allowed).toBe(true);
    expect(result.normalisedPath).toBe('specs/sprints/test.md');
  });

  it('resolves parent-dir segments within allowed zone', () => {
    const result = validatePath({ filePath: 'specs/sprints/../request_changelog/test.md' });
    expect(result.allowed).toBe(true);
    expect(result.normalisedPath).toBe('specs/request_changelog/test.md');
  });
});
