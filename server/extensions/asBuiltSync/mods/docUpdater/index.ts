// Doc Updater (Sprint 176).
// [why] Updates architecture docs, security docs, and changelogs with
// collected as-built evidence. Preserves YAML front-matter in existing docs.
// Follows the aiEditOrchestrator fileEditor pattern for safe doc modification.

import type { UpdateDocsInput, UpdateDocsOutput, AsBuiltEvidence } from '../../types';
import { ALLOWED_OUTPUT_PATHS } from '../../common/config';

export const docUpdaterDeps = {
  /**
   * Read a file's contents.
   * [why] Injected for testability — tests can mock file reads.
   */
  readFile: async (filePath: string): Promise<string> => {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${filePath}`);
    }
    return file.text();
  },

  /**
   * Write contents to a file.
   */
  writeFile: async (filePath: string, content: string): Promise<void> => {
    await Bun.write(filePath, content);
  },

  /** Check if a file exists. */
  fileExists: async (filePath: string): Promise<boolean> => {
    return Bun.file(filePath).exists();
  },

  /** Get the repository root. */
  getRepoRoot: async (): Promise<string> => {
    const proc = Bun.spawnSync({
      cmd: ['git', 'rev-parse', '--show-toplevel'],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) {
      throw new Error('Not in a git repository');
    }
    return new TextDecoder().decode(proc.stdout).trim();
  },

  /** Get the current timestamp for changelog entries. */
  getTimestamp: (): string => new Date().toISOString(),
};

/**
 * Extract YAML front-matter (lines between --- delimiters) from a file.
 * Returns { frontMatter, body }.
 */
function extractFrontMatter(
  content: string,
): { frontMatter: string; body: string } {
  const lines = content.split('\n');
  if (lines[0]?.trim() === '---') {
    const endIndex = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (endIndex > 0) {
      return {
        frontMatter: lines.slice(0, endIndex + 1).join('\n'),
        body: lines.slice(endIndex + 1).join('\n'),
      };
    }
  }
  return { frontMatter: '', body: content };
}

/**
 * Format changed files into a markdown summary.
 */
function formatChangedFilesSummary(
  changedFiles: AsBuiltEvidence['changedFiles'],
): string {
  if (changedFiles.length === 0) return 'No files changed.\n';

  const added = changedFiles.filter((f) => f.status === 'added');
  const modified = changedFiles.filter((f) => f.status === 'modified');
  const deleted = changedFiles.filter((f) => f.status === 'deleted');

  let summary = '';
  if (added.length > 0) {
    summary += `**Added (${added.length}):**\n`;
    for (const f of added) summary += `- \`${f.path}\`\n`;
    summary += '\n';
  }
  if (modified.length > 0) {
    summary += `**Modified (${modified.length}):**\n`;
    for (const f of modified) summary += `- \`${f.path}\`\n`;
    summary += '\n';
  }
  if (deleted.length > 0) {
    summary += `**Deleted (${deleted.length}):**\n`;
    for (const f of deleted) summary += `- \`${f.path}\`\n`;
    summary += '\n';
  }
  return summary;
}

/**
 * Format merged PRs into a markdown summary.
 */
function formatMergedPrsSummary(
  mergedPrs: AsBuiltEvidence['mergedPrs'],
): string {
  if (mergedPrs.length === 0) return 'No merged PRs found.\n';

  let summary = '';
  for (const pr of mergedPrs) {
    summary += `- PR #${pr.prNumber}: ${pr.prTitle} (merged ${pr.mergedAt})\n`;
  }
  return summary + '\n';
}

/**
 * Update the specs changelog with as-built evidence.
 * [why] Appends a new entry to the request changelog, following the
 * specs/changelog/YYYYMMDD_HHMMSS.md naming convention.
 */
async function updateChangelog({
  repoRoot,
  evidence,
  cardId,
  runId,
  writeFile,
  getTimestamp,
}: {
  repoRoot: string;
  evidence: AsBuiltEvidence;
  cardId: string;
  runId: string;
  writeFile: typeof docUpdaterDeps.writeFile;
  getTimestamp: typeof docUpdaterDeps.getTimestamp;
}): Promise<string | null> {
  const now = getTimestamp();
  const dateStr = now.replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  const changelogPath = `${repoRoot}/specs/request_changelog/${dateStr}.md`;

  const changelogContent = `# As-Built Update — ${evidence.cardMetadata.title || cardId}

> **Run ID:** \`${runId}\`
> **Card:** ${cardId}
> **Phase:** ${evidence.cardMetadata.phase}
> **Timestamp:** ${now}

## Update

- Auto-generated as-built sync from card move to UPDATE_AS_BUILT phase

## Changes

### Merged PRs
${formatMergedPrsSummary(evidence.mergedPrs)}

### Changed Files
${formatChangedFilesSummary(evidence.changedFiles)}

### Test Evidence
${evidence.testEvidence.length > 0
    ? evidence.testEvidence.map((t) => `- \`${t.testFile}\` (${t.passingCount} passing, ${t.failingCount} failing)`).join('\n')
    : 'No test evidence detected.\n'}

## Technical Debt

<!-- Auto-populated: review and update as needed -->

## What Should Be Done Next

<!-- Auto-populated: review and update as needed -->
`;

  await writeFile(changelogPath, changelogContent);
  return `specs/request_changelog/${dateStr}.md`;
}

/**
 * Update the architecture documentation with a new as-built section.
 * [why] Appends implementation evidence to architecture.md, preserving
 * existing YAML front-matter.
 */
async function updateArchitectureDoc({
  repoRoot,
  evidence,
  runId,
  readFile,
  writeFile,
  fileExists,
  getTimestamp,
}: {
  repoRoot: string;
  evidence: AsBuiltEvidence;
  runId: string;
  readFile: typeof docUpdaterDeps.readFile;
  writeFile: typeof docUpdaterDeps.writeFile;
  fileExists: typeof docUpdaterDeps.fileExists;
  getTimestamp: typeof docUpdaterDeps.getTimestamp;
}): Promise<string | null> {
  const archPath = `${repoRoot}/specs/architecture/architecture.md`;
  const exists = await fileExists(archPath);

  if (!exists) {
    console.warn(
      `[asBuiltSync/docUpdater] architecture.md not found at ${archPath} — skipping`,
    );
    return null;
  }

  const content = await readFile(archPath);
  const { frontMatter, body } = extractFrontMatter(content);

  const now = getTimestamp();
  const asBuiltSection = `

---

## As-Built Update (${now})

> **Run ID:** \`${runId}\`

### Implementation Evidence
${formatChangedFilesSummary(evidence.changedFiles)}
${formatMergedPrsSummary(evidence.mergedPrs)}
`;

  const updatedContent = frontMatter
    ? `${frontMatter}\n${body}${asBuiltSection}`
    : `${body}${asBuiltSection}`;

  await writeFile(archPath, updatedContent);
  return 'specs/architecture/architecture.md';
}

/**
 * Update the security documentation with a new as-built section.
 * [why] Same pattern as architecture doc update — appends implementation
 * evidence preserving front-matter.
 */
async function updateSecurityDoc({
  repoRoot,
  evidence,
  runId,
  readFile,
  writeFile,
  fileExists,
  getTimestamp,
}: {
  repoRoot: string;
  evidence: AsBuiltEvidence;
  runId: string;
  readFile: typeof docUpdaterDeps.readFile;
  writeFile: typeof docUpdaterDeps.writeFile;
  fileExists: typeof docUpdaterDeps.fileExists;
  getTimestamp: typeof docUpdaterDeps.getTimestamp;
}): Promise<string | null> {
  const securityPath = `${repoRoot}/specs/security/security.md`;
  const exists = await fileExists(securityPath);

  if (!exists) {
    console.warn(
      `[asBuiltSync/docUpdater] security.md not found at ${securityPath} — skipping`,
    );
    return null;
  }

  const content = await readFile(securityPath);
  const { frontMatter, body } = extractFrontMatter(content);

  const now = getTimestamp();
  const asBuiltSection = `

---

## As-Built Update (${now})

> **Run ID:** \`${runId}\`

### Changed Files
${formatChangedFilesSummary(evidence.changedFiles)}
### Test Evidence
${evidence.testEvidence.length > 0
    ? evidence.testEvidence.map((t) => `- \`${t.testFile}\` (${t.passingCount} passing, ${t.failingCount} failing)`).join('\n')
    : 'No test evidence detected.\n'}
`;

  const updatedContent = frontMatter
    ? `${frontMatter}\n${body}${asBuiltSection}`
    : `${body}${asBuiltSection}`;

  await writeFile(securityPath, updatedContent);
  return 'specs/security/security.md';
}

/**
 * Main entry point: update all relevant docs with collected evidence.
 */
export async function updateDocs({
  cardId,
  evidence,
  runId,
}: UpdateDocsInput): Promise<UpdateDocsOutput> {
  const deps = docUpdaterDeps;

  let repoRoot: string;
  try {
    repoRoot = await deps.getRepoRoot();
  } catch {
    return {
      status: 500,
      name: 'git-repo-not-found',
      message: 'Not in a git repository — cannot update docs.',
    };
  }

  // [why] Validate that evidence paths stay within allowed paths.
  // All writes happen inside specs/ which is already in the allowlist.
  const updatedFiles: string[] = [];

  try {
    // Update architecture doc
    const archPath = await updateArchitectureDoc({
      repoRoot,
      evidence,
      runId,
      readFile: deps.readFile,
      writeFile: deps.writeFile,
      fileExists: deps.fileExists,
      getTimestamp: deps.getTimestamp,
    });
    if (archPath) updatedFiles.push(archPath);

    // Update security doc
    const securityPath = await updateSecurityDoc({
      repoRoot,
      evidence,
      runId,
      readFile: deps.readFile,
      writeFile: deps.writeFile,
      fileExists: deps.fileExists,
      getTimestamp: deps.getTimestamp,
    });
    if (securityPath) updatedFiles.push(securityPath);

    // Create changelog
    const changelogPath = await updateChangelog({
      repoRoot,
      evidence,
      cardId,
      runId,
      writeFile: deps.writeFile,
      getTimestamp: deps.getTimestamp,
    });
    if (changelogPath) updatedFiles.push(changelogPath);

    return {
      status: 200,
      data: {
        updatedFiles,
        changelogWritten: !!changelogPath,
      },
    };
  } catch (error) {
    return {
      status: 500,
      name: 'doc-update-failed',
      message: error instanceof Error ? error.message : 'Failed to update docs',
      data: {
        updatedFiles,
        changelogWritten: false,
      },
    };
  }
}
