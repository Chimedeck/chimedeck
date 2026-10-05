// Doc updater tests (Sprint 176).
// [why] Verifies that doc updates preserve YAML front-matter, correctly
// format evidence into markdown, and handle missing files gracefully.
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { docUpdaterDeps } from '../index';

const { updateDocs } = await import('../index');

describe('docUpdater', () => {
  let originalReadFile: typeof docUpdaterDeps.readFile;
  let originalWriteFile: typeof docUpdaterDeps.writeFile;
  let originalFileExists: typeof docUpdaterDeps.fileExists;
  let originalGetRepoRoot: typeof docUpdaterDeps.getRepoRoot;
  let writtenFiles: Record<string, string>;

  beforeEach(() => {
    originalReadFile = docUpdaterDeps.readFile;
    originalWriteFile = docUpdaterDeps.writeFile;
    originalFileExists = docUpdaterDeps.fileExists;
    originalGetRepoRoot = docUpdaterDeps.getRepoRoot;

    writtenFiles = {};

    docUpdaterDeps.readFile = mock(async (path: string) => {
      if (path.includes('architecture.md')) {
        return '---\ntitle: Architecture\n---\n\n# Architecture\n\nOriginal content.\n';
      }
      if (path.includes('security.md')) {
        return '---\ntitle: Security\n---\n\n# Security\n\nOriginal security content.\n';
      }
      throw new Error(`File not found: ${path}`);
    }) as any;

    docUpdaterDeps.writeFile = mock(async (path: string, content: string) => {
      writtenFiles[path] = content;
    }) as any;

    docUpdaterDeps.fileExists = mock(async (path: string) => {
      return path.includes('architecture.md') || path.includes('security.md');
    }) as any;

    docUpdaterDeps.getRepoRoot = mock(async () => '/fake/repo') as any;
    docUpdaterDeps.getTimestamp = mock(() => '2026-06-10T12:00:00.000Z') as any;
  });

  const sampleEvidence = {
    mergedPrs: [
      {
        prNumber: '42',
        prTitle: 'feat: add sprint generation',
        mergedAt: '2026-06-09',
        branchName: 'feature/sprint-gen',
      },
    ],
    changedFiles: [
      { path: 'specs/sprints/sprint-177.md', status: 'added' as const },
      { path: 'specs/architecture/architecture.md', status: 'modified' as const },
    ],
    testEvidence: [
      {
        testFile: 'server/extensions/sprintGeneration/__tests__/index.test.ts',
        testCount: 15,
        passingCount: 15,
        failingCount: 0,
      },
    ],
    cardMetadata: {
      title: 'Test Feature Card',
      description: 'Some description',
      phase: 'Update As Built',
      boardId: 'board-1',
      listId: 'list-1',
    },
  };

  it('should return error when not in a git repo', async () => {
    docUpdaterDeps.getRepoRoot = mock(() => {
      throw new Error('Not in a git repository');
    }) as any;

    const result = await updateDocs({
      cardId: 'card-1',
      evidence: sampleEvidence,
      runId: 'run-1',
    });

    expect(result.status).toBe(500);
    expect(result.name).toBe('git-repo-not-found');
  });

  it('should preserve YAML front-matter in architecture doc', async () => {
    const result = await updateDocs({
      cardId: 'card-1',
      evidence: sampleEvidence,
      runId: 'run-1',
    });

    expect(result.status).toBe(200);
    expect(result.data?.updatedFiles).toContain('specs/architecture/architecture.md');

    // Verify front-matter is preserved
    const archContent = writtenFiles['/fake/repo/specs/architecture/architecture.md'];
    expect(archContent).toBeDefined();
    expect(archContent).toStartWith('---');
    expect(archContent).toContain('title: Architecture');
    // Should contain the original content plus new as-built section
    expect(archContent).toContain('Original content.');
    expect(archContent).toContain('As-Built Update');
  });

  it('should create a changelog entry', async () => {
    const result = await updateDocs({
      cardId: 'card-1',
      evidence: sampleEvidence,
      runId: 'run-1',
    });

    expect(result.status).toBe(200);
    expect(result.data?.changelogWritten).toBe(true);

    const changelogPath = Object.keys(writtenFiles).find((k) => k.includes('request_changelog'));
    expect(changelogPath).toBeDefined();
    const changelogContent = writtenFiles[changelogPath!];
    expect(changelogContent).toContain('As-Built Update');
    expect(changelogContent).toContain('Run ID');
    expect(changelogContent).toContain('PR #42');
    expect(changelogContent).toContain('sprint-177.md');
  });

  it('should include changed file summary in docs', async () => {
    const result = await updateDocs({
      cardId: 'card-1',
      evidence: sampleEvidence,
      runId: 'run-1',
    });

    expect(result.status).toBe(200);

    const changelogPath = Object.keys(writtenFiles).find((k) => k.includes('request_changelog'));
    const changelogContent = writtenFiles[changelogPath!];
    expect(changelogContent).toContain('Added (1)');
    expect(changelogContent).toContain('Modified (1)');
  });

  it('should include test evidence in security doc', async () => {
    const result = await updateDocs({
      cardId: 'card-1',
      evidence: sampleEvidence,
      runId: 'run-1',
    });

    expect(result.status).toBe(200);

    const securityContent = writtenFiles['/fake/repo/specs/security/security.md'];
    expect(securityContent).toBeDefined();
    expect(securityContent).toContain('Test Evidence');
    expect(securityContent).toContain('15 passing');
  });

  it('should handle missing security doc gracefully', async () => {
    docUpdaterDeps.fileExists = mock(async (path: string) => {
      return path.includes('architecture.md');
    }) as any;

    const result = await updateDocs({
      cardId: 'card-1',
      evidence: sampleEvidence,
      runId: 'run-1',
    });

    expect(result.status).toBe(200);
    // Security doc should be skipped, not in updated files
    expect(result.data?.updatedFiles).not.toContain('specs/security/security.md');
  });

  it('should handle empty evidence gracefully', async () => {
    const emptyEvidence = {
      mergedPrs: [],
      changedFiles: [],
      testEvidence: [],
      cardMetadata: {
        title: 'Test',
        description: '',
        phase: '',
        boardId: '',
        listId: '',
      },
    };

    const result = await updateDocs({
      cardId: 'card-1',
      evidence: emptyEvidence,
      runId: 'run-1',
    });

    expect(result.status).toBe(200);

    const changelogPath = Object.keys(writtenFiles).find((k) => k.includes('request_changelog'));
    const changelogContent = writtenFiles[changelogPath!];
    expect(changelogContent).toContain('No files changed');
    expect(changelogContent).toContain('No merged PRs found');
    expect(changelogContent).toContain('No test evidence detected');
  });
});
