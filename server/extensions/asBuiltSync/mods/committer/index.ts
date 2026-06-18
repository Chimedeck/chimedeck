// As-Built Sync Committer (Sprint 176).
// [why] Reuses the aiEditOrchestrator committer pattern for staging,
// committing, and pushing as-built doc updates. The same git command
// injection pattern is used for testability.
import { commit } from '../../../aiEditOrchestrator/mods/committer';
import { COMMIT_MESSAGE_TEMPLATE } from '../../common/config';
import type { AsBuiltCommitInput } from '../../types';

export const asBuiltCommitterDeps = {
  commit,
};

export interface AsBuiltCommitResult {
  status: number;
  name?: string;
  message?: string;
  data?: {
    commitHash: string;
    files: string[];
  };
}

/**
 * Stage and commit as-built sync doc updates.
 * [why] Wraps the aiEditOrchestrator committer with as-built-specific
 * commit message templating. The underlying commit function handles
 * git add/push with run-scoped file isolation.
 */
export async function commitAsBuilt({
  runId,
  cardId,
  touchedFiles,
}: AsBuiltCommitInput): Promise<AsBuiltCommitResult> {
  const deps = asBuiltCommitterDeps;

  if (touchedFiles.length === 0) {
    return {
      status: 200,
      message: 'No files to commit',
      data: { commitHash: '', files: [] },
    };
  }

  const commitMessage = COMMIT_MESSAGE_TEMPLATE.replace('{cardId}', cardId);

  const result = await deps.commit({
    runId,
    cardId,
    touchedFiles,
    message: commitMessage,
    push: true,
  });

  // [why] Normalise the aiEditOrchestrator committer output to our shape.
  // The upstream committer can return commitHash in data or as a string.
  const commitHash =
    typeof (result as any).data?.commitHash === 'string'
      ? (result as any).data.commitHash
      : typeof result.data === 'string'
        ? result.data
        : '';

  return {
    status: result.status,
    name: result.name,
    message: result.message,
    data: {
      commitHash,
      files: Array.isArray((result as any).data?.files) ? (result as any).data.files : touchedFiles,
    },
  };
}
