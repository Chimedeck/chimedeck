// Committer — stages only run-scoped files, creates commit, pushes via git.
// [why] Commits are scoped to only the files touched by the edit run,
// with a standardized message template. Uses GitHub App for authentication
// via the configured git remote.
import type { CommitInput, CommitResult } from '../../types';

export const committerDeps = {
  /**
   * Run a shell command and return stdout.
   * [why] Injected for testability — tests can mock git commands.
   */
  exec: async (cmd: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    const proc = Bun.spawnSync({
      cmd,
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return {
      stdout: new TextDecoder().decode(proc.stdout),
      stderr: new TextDecoder().decode(proc.stderr),
      exitCode: proc.exitCode,
    };
  },

  /** Get the repository root from git. */
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
};

/**
 * Stage only the specified files, create a commit, and optionally push.
 * [why] We deliberately `git add` only the run-scoped files to avoid
 * accidentally committing unrelated changes in the working directory.
 */
export async function commit({
  runId,
  cardId,
  touchedFiles,
  message,
  push = true,
}: CommitInput): Promise<CommitResult> {
  if (touchedFiles.length === 0) {
    return {
      status: 200,
      data: { commitHash: '', files: [] },
      message: 'No files to commit',
    };
  }

  let repoRoot: string;
  try {
    repoRoot = await committerDeps.getRepoRoot();
  } catch (error) {
    return {
      status: 500,
      name: 'git-repo-not-found',
      message: error instanceof Error ? error.message : 'Not in a git repository',
    };
  }

  // 1. Verify all files exist
  const missingFiles: string[] = [];
  for (const file of touchedFiles) {
    const f = Bun.file(`${repoRoot}/${file}`);
    if (!(await f.exists())) {
      missingFiles.push(file);
    }
  }
  if (missingFiles.length > 0) {
    return {
      status: 404,
      name: 'files-missing',
      data: { commitHash: '', files: missingFiles },
      message: `Some files do not exist: [${missingFiles.join(', ')}]`,
    };
  }

  // 2. Stage only the run-scoped files
  const addResult = await committerDeps.exec(['git', 'add', ...touchedFiles], repoRoot);
  if (addResult.exitCode !== 0) {
    return {
      status: 500,
      name: 'git-add-failed',
      data: { commitHash: '', files: touchedFiles },
      message: `git add failed: ${addResult.stderr}`,
    };
  }

  // 3. Create commit
  // [why] Append runId to commit message for traceability
  const fullMessage = `${message}\n\n[ai-edit-run: ${runId}]`;
  const commitResult = await committerDeps.exec(
    ['git', 'commit', '-m', fullMessage],
    repoRoot,
  );
  if (commitResult.exitCode !== 0) {
    // [why] Nothing to commit means all files were already committed
    if (commitResult.stderr.includes('nothing to commit')) {
      // Get the current HEAD hash
      const headResult = await committerDeps.exec(
        ['git', 'rev-parse', 'HEAD'],
        repoRoot,
      );
      return {
        status: 200,
        data: {
          commitHash: headResult.stdout.trim(),
          files: touchedFiles,
        },
        message: 'No changes to commit — files already committed',
      };
    }
    return {
      status: 500,
      name: 'git-commit-failed',
      data: { commitHash: '', files: touchedFiles },
      message: `git commit failed: ${commitResult.stderr}`,
    };
  }

  // 4. Get the commit hash
  const hashResult = await committerDeps.exec(
    ['git', 'rev-parse', 'HEAD'],
    repoRoot,
  );
  const commitHash = hashResult.stdout.trim();

  // 5. Push if requested
  if (push) {
    const pushResult = await committerDeps.exec(
      ['git', 'push', 'origin', 'HEAD'],
      repoRoot,
    );
    if (pushResult.exitCode !== 0) {
      // [why] Push failure is not fatal — the commit exists locally
      // and can be pushed manually or on retry.
      return {
        status: 200,
        name: 'push-failed',
        data: { commitHash, files: touchedFiles },
        message: `Commit ${commitHash} created but push failed: ${pushResult.stderr}. Retry push manually.`,
      };
    }
  }

  return {
    status: 200,
    data: { commitHash, files: touchedFiles },
  };
}
