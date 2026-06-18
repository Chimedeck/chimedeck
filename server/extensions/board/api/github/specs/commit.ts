// POST /api/v1/boards/:boardId/github/specs/commit
// Commit staged markdown file changes from the specs worktree.
import {
  authenticate,
  type AuthenticatedRequest,
} from '../../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../../middlewares/permissionManager';
import {
  requireBoardAccess,
  type BoardScopedRequest,
} from '../../../middlewares/requireBoardAccess';
import { guestDeniedError } from '../../../mods/guestPermissions';
import { downloadRepositoryFromProjectUrl } from '../../../mods/githubRepository/downloadRepositoryFromProjectUrl';
import { getGithubInstallationAccessToken } from '../../../mods/githubRepository/githubApp';
import { normalizeGithubProjectUrl } from '../../../mods/githubProjectUrl';
import { githubRepositoryConfig } from '../../../common/config/githubRepository';
import { commitSpecsChanges } from '../../../mods/specs/commit';
import type { CommitSpecsBody } from '../../../types';

export const specsCommitDeps = {
  authenticate,
  requireBoardAccess,
  requireWorkspaceMembership,
  requireRole,
  downloadRepositoryFromProjectUrl,
  getGithubInstallationAccessToken,
  normalizeGithubProjectUrl,
  commitSpecsChanges,
};

function requireSpecsWriteAccess(req: WorkspaceScopedRequest): Response | null {
  if (req.callerRole === 'GUEST') {
    if (req.guestType === 'MEMBER') {
      return null;
    }
    return Response.json(
      {
        name: req.guestType === 'VIEWER' ? guestDeniedError('VIEWER') : 'guest-role-no-org-access',
        data: { message: 'Guest does not have permission to edit board specs' },
      },
      { status: 403 }
    );
  }

  return requireRole(req, 'MEMBER');
}

function mapCommitError(err: unknown): Response {
  const message = err instanceof Error ? err.message : 'unknown-error';
  if (message === 'missing-changed-files') {
    return Response.json(
      { name: message, data: { message: 'At least one changed file is required' } },
      { status: 400 }
    );
  }

  if (message === 'specs-file-must-be-markdown') {
    return Response.json(
      { name: message, data: { message: 'Only specs markdown files can be committed' } },
      { status: 422 }
    );
  }

  return Response.json({ name: 'specs-commit-failed', data: { message } }, { status: 502 });
}

async function resolvePushToken({ projectUrl }: { projectUrl: string }): Promise<string | null> {
  const normalized = specsCommitDeps.normalizeGithubProjectUrl({ value: projectUrl });
  if (!normalized.ok) {
    throw new Error(normalized.message);
  }

  try {
    return await specsCommitDeps.getGithubInstallationAccessToken({
      reference: normalized.value.reference,
    });
  } catch {
    return null;
  }
}

export async function handleCommitSpecs(req: Request, boardId: string): Promise<Response> {
  const authError = await specsCommitDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await specsCommitDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await specsCommitDeps.requireWorkspaceMembership(
    workspaceReq,
    boardReq.board!.workspace_id
  );
  if (membershipError) return membershipError;

  const writeAccessError = requireSpecsWriteAccess(workspaceReq);
  if (writeAccessError) return writeAccessError;

  const board = boardReq.board as { github_project_url?: string | null };
  if (!board.github_project_url) {
    return Response.json(
      {
        name: 'specs-not-configured',
        data: { message: 'You must configure your Github documentation respository first' },
      },
      { status: 403 }
    );
  }

  let body: CommitSpecsBody;
  try {
    body = (await req.json()) as CommitSpecsBody;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  if (typeof body.message !== 'string' || !Array.isArray(body.changedFiles)) {
    return Response.json(
      { name: 'invalid-field-type', data: { message: 'message and changedFiles are required' } },
      { status: 400 }
    );
  }

  const changedFiles = body.changedFiles.filter(
    (value): value is string => typeof value === 'string'
  );
  if (changedFiles.length !== body.changedFiles.length) {
    return Response.json(
      { name: 'invalid-field-type', data: { message: 'changedFiles must contain only strings' } },
      { status: 400 }
    );
  }

  let repo;
  try {
    repo = await specsCommitDeps.downloadRepositoryFromProjectUrl({
      projectUrl: board.github_project_url,
      boardId,
    });
  } catch (err) {
    return Response.json(
      {
        name: 'specs-load-failed',
        data: { message: 'Our app do not have access to this respository' },
      },
      { status: 403 }
    );
  }

  const actorId = (req as AuthenticatedRequest).currentUser!.id;
  let pushToken: string | null = null;
  try {
    pushToken = await resolvePushToken({ projectUrl: board.github_project_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown-error';
    return Response.json({ name: 'specs-commit-failed', data: { message } }, { status: 502 });
  }

  try {
    const result = await specsCommitDeps.commitSpecsChanges({
      repoPath: repo.repoPath,
      branch: repo.ref,
      changedFiles,
      message: body.message,
      actorId,
      boardId,
      botAlias: githubRepositoryConfig.appBotAlias,
      pushToken,
    });

    return Response.json(
      {
        data: {
          commitHash: result.commitHash,
          pushStatus: result.pushStatus,
          branch: result.branch,
          changedFiles: result.changedFiles,
          footer: result.footer,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return mapCommitError(err);
  }
}
