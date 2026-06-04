// PUT /api/v1/boards/:boardId/github/specs/file
// Delta-save a single markdown file into the checked-out specs repository.
import { authenticate, type AuthenticatedRequest } from '../../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../../middlewares/requireBoardAccess';
import { guestDeniedError } from '../../../mods/guestPermissions';
import { downloadRepositoryFromProjectUrl } from '../../../mods/githubRepository/downloadRepositoryFromProjectUrl';
import { writeSpecsFile } from '../../../mods/specs/write';
import {
  invalidateSpecsCachesForBoard,
} from '../../../mods/specs/cache';
import type { PutSpecsFileBody } from '../../../types';

export const specsFileWriteDeps = {
  authenticate,
  requireBoardAccess,
  requireWorkspaceMembership,
  requireRole,
  downloadRepositoryFromProjectUrl,
  writeSpecsFile,
  invalidateSpecsCachesForBoard,
};

function requireSpecsWriteAccess(req: WorkspaceScopedRequest): Response | null {
  if (req.callerRole === 'GUEST') {
    if (req.guestType === 'MEMBER') {
      return null;
    }
    return Response.json(
      {
        name: req.guestType === 'VIEWER'
          ? guestDeniedError('VIEWER')
          : 'guest-role-no-org-access',
        data: { message: 'Guest does not have permission to edit board specs' },
      },
      { status: 403 },
    );
  }

  return requireRole(req, 'MEMBER');
}

function mapWriteError(err: unknown): Response {
  const message = err instanceof Error ? err.message : 'unknown-error';
  if (message === 'stale-specs-file-precondition') {
    return Response.json(
      { name: message, data: { message: 'The file changed on the server. Reload and try again.' } },
      { status: 412 },
    );
  }
  if (message === 'missing-specs-file-precondition') {
    return Response.json(
      { name: message, data: { message: 'If-Match header is required when updating an existing file.' } },
      { status: 412 },
    );
  }

  if (
    message === 'specs-file-must-be-markdown'
    || message === 'path-must-be-relative'
    || message === 'path-contains-null-byte'
    || message === 'path-traversal-detected'
  ) {
    return Response.json(
      { name: message, data: { message: 'Only specs markdown files can be saved' } },
      { status: message === 'path-must-be-relative' || message === 'path-contains-null-byte' || message === 'path-traversal-detected' ? 400 : 422 },
    );
  }

  return Response.json(
    { name: 'specs-save-failed', data: { message } },
    { status: 502 },
  );
}

export async function handlePutSpecsFile(req: Request, boardId: string): Promise<Response> {
  const authError = await specsFileWriteDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await specsFileWriteDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await specsFileWriteDeps.requireWorkspaceMembership(
    workspaceReq,
    boardReq.board!.workspace_id,
  );
  if (membershipError) return membershipError;

  const writeAccessError = requireSpecsWriteAccess(workspaceReq);
  if (writeAccessError) return writeAccessError;

  const board = boardReq.board as { github_project_url?: string | null };
  if (!board.github_project_url) {
    return Response.json(
      { name: 'specs-not-configured', data: { message: 'No GitHub project URL is configured for this board' } },
      { status: 422 },
    );
  }

  let body: PutSpecsFileBody;
  try {
    body = (await req.json()) as PutSpecsFileBody;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (typeof body.path !== 'string' || typeof body.content !== 'string') {
    return Response.json(
      { name: 'invalid-field-type', data: { message: 'path and content are required' } },
      { status: 400 },
    );
  }

  let repoPath: string;
  try {
    const result = await specsFileWriteDeps.downloadRepositoryFromProjectUrl({
      projectUrl: board.github_project_url,
      boardId,
    });
    repoPath = result.repoPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown-error';
    return Response.json(
      { name: 'specs-load-failed', data: { message } },
      { status: 502 },
    );
  }

  try {
    const saved = await specsFileWriteDeps.writeSpecsFile({
      repoPath,
      filePath: body.path,
      content: body.content,
      ifMatch: req.headers.get('if-match'),
    });

    specsFileWriteDeps.invalidateSpecsCachesForBoard({
      boardId,
      projectUrl: board.github_project_url,
      repoPath,
    });

    return Response.json(
      {
        data: {
          path: saved.path,
          content: body.content,
          etag: saved.etag,
          sha: saved.sha,
          created: saved.created,
        },
      },
      {
        status: saved.created ? 201 : 200,
        headers: { ETag: `"${saved.etag}"` },
      },
    );
  } catch (err) {
    return mapWriteError(err);
  }
}
