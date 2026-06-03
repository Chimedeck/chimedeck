import { createGithubRepositoryGit } from '../githubRepository/git';

export interface CommitSpecsChangesInput {
  repoPath: string;
  branch: string;
  changedFiles: string[];
  message: string;
  actorId: string;
  boardId: string;
  botAlias: string;
  pushToken?: string | null;
}

export interface CommitSpecsChangesResult {
  commitHash: string;
  pushStatus: 'pushed' | 'pending';
  branch: string;
  changedFiles: string[];
  footer: {
    actorId: string;
    boardId: string;
    botAlias: string;
  };
}

function normalizeChangedFiles(changedFiles: string[]): string[] {
  return [...new Set(changedFiles.map((file) => file.trim()).filter((file) => file.length > 0))];
}

function assertSpecsMarkdownPath(filePath: string): void {
  const normalized = filePath.replace(/^\/+/, '');
  if (!normalized.startsWith('specs/') || !normalized.endsWith('.md')) {
    throw new Error('specs-file-must-be-markdown');
  }
}

function buildCommitBody({
  message,
  actorId,
  boardId,
  botAlias,
  changedFiles,
}: {
  message: string;
  actorId: string;
  boardId: string;
  botAlias: string;
  changedFiles: string[];
}): string {
  const footerLines = [
    `Actor-Id: ${actorId}`,
    `Board-Id: ${boardId}`,
    `Bot-Alias: ${botAlias}`,
    `Changed-Files: ${changedFiles.join(', ')}`,
  ];
  return `${message.trim()}\n\n${footerLines.join('\n')}`;
}

export async function commitSpecsChanges({
  repoPath,
  branch,
  changedFiles,
  message,
  actorId,
  boardId,
  botAlias,
  pushToken = null,
}: CommitSpecsChangesInput): Promise<CommitSpecsChangesResult> {
  const files = normalizeChangedFiles(changedFiles);
  if (files.length === 0) {
    throw new Error('missing-changed-files');
  }

  for (const file of files) {
    assertSpecsMarkdownPath(file);
  }

  const commitBody = buildCommitBody({ message, actorId, boardId, botAlias, changedFiles: files });
  const git = createGithubRepositoryGit({ baseDir: repoPath, token: pushToken, botAlias });

  await git.add(files);
  await git.commit(commitBody);

  const commitHash = (await git.raw(['rev-parse', 'HEAD'])).trim();

  if (pushToken) {
    await git.push('origin', branch);
    return {
      commitHash,
      pushStatus: 'pushed',
      branch,
      changedFiles: files,
      footer: { actorId, boardId, botAlias },
    };
  }

  return {
    commitHash,
    pushStatus: 'pending',
    branch,
    changedFiles: files,
    footer: { actorId, boardId, botAlias },
  };
}
