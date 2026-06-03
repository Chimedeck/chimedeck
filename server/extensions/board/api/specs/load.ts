// GET /api/v1/boards/:id/specs/manifest
// Returns a manifest (sorted list of .md file paths + metadata) derived from
// the board's linked GitHub repository.  Requires MEMBER or higher; guests denied.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { downloadRepositoryFromProjectUrl } from '../../mods/githubRepository/downloadRepositoryFromProjectUrl';
import { buildSpecsManifest } from '../../mods/specs/manifest';
import {
  specsManifestCache,
  specsManifestInflight,
  MANIFEST_CACHE_TTL_MS,
} from '../../mods/specs/cache';
import type { SpecsManifest } from '../../types';

export const specsLoadDeps = {
  authenticate,
  requireBoardAccess,
  requireWorkspaceMembership,
  requireRole,
  downloadRepositoryFromProjectUrl,
  buildSpecsManifest,
  now: () => new Date(),
};

async function getOrBuildManifest({
  boardId,
  projectUrl,
  refresh,
}: {
  boardId: string;
  projectUrl: string;
  refresh: boolean;
}): Promise<{ manifest: SpecsManifest; repoPath: string }> {
  const cacheKey = `${boardId}:${projectUrl}`;

  if (!refresh) {
    const cached = specsManifestCache.get(cacheKey);
    if (cached) {
      const nowMs = specsLoadDeps.now().getTime();
      if (nowMs - cached.cachedAtMs < MANIFEST_CACHE_TTL_MS) {
        return { manifest: cached.manifest, repoPath: cached.repoPath };
      }
      specsManifestCache.delete(cacheKey);
    }
  }

  const inflight = specsManifestInflight.get(cacheKey);
  if (inflight) return inflight;

  const task = (async () => {
    const { repoPath, ref, fetchedAt } = await specsLoadDeps.downloadRepositoryFromProjectUrl({
      projectUrl,
      boardId,
      refresh,
    });

    const manifest = await specsLoadDeps.buildSpecsManifest({ repoPath, ref, fetchedAt });

    specsManifestCache.set(cacheKey, {
      manifest,
      repoPath,
      cachedAtMs: specsLoadDeps.now().getTime(),
    });

    return { manifest, repoPath };
  })().finally(() => {
    specsManifestInflight.delete(cacheKey);
  });

  specsManifestInflight.set(cacheKey, task);
  return task;
}

export async function handleLoadSpecsManifest(req: Request, boardId: string): Promise<Response> {
  const authError = await specsLoadDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await specsLoadDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await specsLoadDeps.requireWorkspaceMembership(
    workspaceReq,
    boardReq.board!.workspace_id,
  );
  if (membershipError) return membershipError;

  // Specs are internal documentation; guests are not permitted.
  const roleError = specsLoadDeps.requireRole(workspaceReq, 'MEMBER');
  if (roleError) return roleError;

  const board = boardReq.board as { github_project_url?: string | null };
  if (!board.github_project_url) {
    return Response.json(
      { name: 'specs-not-configured', data: { message: 'No GitHub project URL is configured for this board' } },
      { status: 422 },
    );
  }

  const url = new URL(req.url);
  const refresh = url.searchParams.get('refresh') === 'true';

  let result: { manifest: SpecsManifest; repoPath: string };
  try {
    result = await getOrBuildManifest({
      boardId,
      projectUrl: board.github_project_url,
      refresh,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown-error';
    return Response.json(
      { name: 'specs-load-failed', data: { message } },
      { status: 502 },
    );
  }

  const { manifest } = result;

  // Support conditional GET — return 304 when client already has the latest manifest.
  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch === `"${manifest.etag}"`) {
    return new Response(null, { status: 304 });
  }

  return Response.json(
    { data: manifest },
    {
      headers: {
        ETag: `"${manifest.etag}"`,
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}
