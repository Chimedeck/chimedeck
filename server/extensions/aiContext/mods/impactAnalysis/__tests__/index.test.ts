import { describe, it, expect } from 'vitest';
import { analyseImpact } from '../index';
import type { ImpactFS } from '../index';

function mockFS(files: Record<string, { content: string; mtimeMs?: number }>): ImpactFS {
  return {
    readFile: (filePath: string) => {
      const file = files[filePath];
      if (!file) throw new Error(`File not found: ${filePath}`);
      return file.content;
    },
    statFile: (filePath: string) => {
      const file = files[filePath];
      if (!file) return null;
      return { mtimeMs: file.mtimeMs ?? Date.now() - 10 * 24 * 60 * 60 * 1000 };
    },
    globFiles: () => Object.keys(files),
  };
}

describe('analyseImpact', () => {
  it('returns empty when no spec files exist', () => {
    const fs = mockFS({});
    const result = analyseImpact({
      cardIntent: 'Build authentication',
      intentDescription: 'Implement login',
      repoRoot: '/repo',
      fs,
    });
    expect(result.likelyImpactedFiles).toEqual([]);
    expect(result.overallOverlapScore).toBe(0);
  });

  it('detects impacted files by keyword overlap', () => {
    const fs = mockFS({
      '/repo/specs/architecture/auth.md': {
        content: 'Authentication system using OAuth. Login flow, token management.',
      },
      '/repo/specs/sprints/sprint-1.md': {
        content: 'Build the dashboard UI with charts and graphs.',
      },
    });
    const result = analyseImpact({
      cardIntent: 'Add OAuth authentication',
      intentDescription: 'Implement login with Google',
      repoRoot: '/repo',
      fs,
    });
    expect(result.likelyImpactedFiles.length).toBeGreaterThan(0);
    const authFile = result.likelyImpactedFiles.find(
      (f) => f.filePath === 'specs/architecture/auth.md'
    );
    expect(authFile).toBeDefined();
    expect(authFile!.impactScore).toBeGreaterThan(0);
  });

  it('boosts recently modified files', () => {
    const fs = mockFS({
      '/repo/specs/architecture/recent.md': {
        content: 'Authentication flow design',
        mtimeMs: Date.now() - 60_000, // 1 minute ago
      },
      '/repo/specs/architecture/old.md': {
        content: 'Authentication flow design',
        mtimeMs: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      },
    });
    const result = analyseImpact({
      cardIntent: 'Update authentication flow',
      intentDescription: 'Auth changes',
      repoRoot: '/repo',
      fs,
    });
    const recentFile = result.likelyImpactedFiles.find(
      (f) => f.filePath === 'specs/architecture/recent.md'
    );
    const oldFile = result.likelyImpactedFiles.find(
      (f) => f.filePath === 'specs/architecture/old.md'
    );
    expect(recentFile).toBeDefined();
    expect(oldFile).toBeDefined();
    // Recent file should have higher (boosted) score
    expect(recentFile!.impactScore).toBeGreaterThan(oldFile!.impactScore);
  });

  it('filters out files below threshold', () => {
    const fs = mockFS({
      '/repo/specs/architecture/unrelated.md': {
        content: 'Deployment pipeline configuration and CI/CD setup.',
      },
    });
    const result = analyseImpact({
      cardIntent: 'Build authentication system',
      intentDescription: 'OAuth login',
      repoRoot: '/repo',
      fs,
    });
    expect(result.likelyImpactedFiles).toEqual([]);
  });

  it('handles file read errors gracefully', () => {
    const throwFs: ImpactFS = {
      readFile: () => {
        throw new Error('Permission denied');
      },
      statFile: () => null,
      globFiles: () => ['/repo/specs/broken.md'],
    };
    const result = analyseImpact({
      cardIntent: 'test',
      intentDescription: 'test',
      repoRoot: '/repo',
      fs: throwFs,
    });
    expect(result.likelyImpactedFiles).toEqual([]);
  });
});
