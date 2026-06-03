// GET /api/v1/boards/:id/specs/files?path=<relative-file-path>
// Reads a single markdown file from the board's linked repository.
// Requires MEMBER or higher; guests denied.
// Path traversal and size-limit violations are rejected before filesystem access.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { downloadRepositoryFromProjectUrl } from '../../mods/githubRepository/downloadRepositoryFromProjectUrl';
import { buildSpecsManifest } from '../../mods/specs/manifest';
import { readSpecsFile, MAX_FILE_SIZE_BYTES } from '../../mods/specs/read';
import { resolveSpecsFilePath } from '../../mods/specs/resolvePath';
import {
  specsManifestCache,
  specsManifestInflight,
  specsFileCache,
  specsFileInflight,
  MANIFEST_CACHE_TTL_MS,
  FILE_CACHE_TTL_MS,
} from '../../mods/specs/cache';
import type { SpecsManifest } from '../../types';

export const specsReadDeps = {
  authenticate,
  requireBoardAccess,
  requireWorkspaceMembership,
  requireRole,
  downloadRepositoryFromProjectUrl,
  buildSpecsManifest,
  readSpecsFile,
  resolveSpecsFilePath,
  now: () => new Date(),
};

async function getOrBuildManifestForRead({
  boardId,
  projectUrl,
}: {
  boardId: string;
  projectUrl: string;
}): Promise<{ manifest: SpecsManifest; repoPath: string }> {
  const cacheKey = `${boardId}:${projectUrl}`;

  const cached = specsManifestCache.get(cacheKey);
  if (cached) {
    const nowMs = specsReadDeps.now().getTime();
    if (nowMs - cached.cachedAtMs < MANIFEST_CACHE_TTL_MS) {
      return { manifest: cached.manifest, repoPath: cached.repoPath };
    }
    specsManifestCache.delete(cacheKey);
  }

  const inflight = specsManifestInflight.get(cacheKey);
  if (inflight) return inflight;

  const task = (async () => {
    const { repoPath, ref, fetchedAt } = await specsReadDeps.downloadRepositoryFromProjectUrl({
      projectUrl,
      boardId,
    });

    const manifest = await specsReadDeps.buildSpecsManifest({ repoPath, ref, fetchedAt });

    specsManifestCache.set(cacheKey, {
      manifest,
      repoPath,
      cachedAtMs: specsReadDeps.now().getTime(),
    });

    return { manifest, repoPath };
  })().finally(() => {
    specsManifestInflight.delete(cacheKey);
  });

  specsManifestInflight.set(cacheKey, task);
  return task;
}

export async function handleReadSpecsFile(req: Request, boardId: string): Promise<Response> {
  const authError = await specsReadDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await specsReadDeps.requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await specsReadDeps.requireWorkspaceMembership(
    workspaceReq,
    boardReq.board!.workspace_id,
  );
  if (membershipError) return membershipError;

  // Specs are internal documentation; guests are not permitted.
  const roleError = specsReadDeps.requireRole(workspaceReq, 'MEMBER');
  if (roleError) return roleError;

  const board = boardReq.board as { github_project_url?: string | null };
  if (!board.github_project_url) {
    return Response.json(
      { name: 'specs-not-configured', data: { message: 'No GitHub project URL is configured for this board' } },
      { status: 422 },
    );
  }

  const url = new URL(req.url);
  const filePath = url.searchParams.get('path');
  if (!filePath || filePath.trim() === '') {
    return Response.json(
      { name: 'missing-path', data: { message: 'Query parameter ?path= is required' } },
      { status: 400 },
    );
  }

  // Retrieve (or trigger) the manifest so we know the repo root and can validate the path.
  let repoPath: string;
  let manifest: SpecsManifest;
  try {
    const loaded = await getOrBuildManifestForRead({
      boardId,
      projectUrl: board.github_project_url,
    });
    repoPath = loaded.repoPath;
    manifest = loaded.manifest;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown-error';
    return Response.json(
      { name: 'specs-load-failed', data: { message } },
      { status: 502 },
    );
  }

  // Reject path traversal attempts before touching the filesystem.
  const resolved = specsReadDeps.resolveSpecsFilePath({ repoPath, filePath });
  if (!resolved.ok) {
    return Response.json(
      { name: 'path-traversal-rejected', data: { reason: resolved.reason } },
      { status: 400 },
    );
  }

  // Manifest-first: only allow paths that appear in the manifest.
  const inManifest = manifest.files.some((f) => f.path === filePath || f.path === filePath.replace(/^\//, ''));
  if (!inManifest) {
    return Response.json(
      { name: 'specs-file-not-found', data: { message: 'File not found in specs manifest' } },
      { status: 404 },
    );
  }

  // Check the manifest-recorded size before attempting to read (fast path to reject large files).
  const manifestEntry = manifest.files.find(
    (f) => f.path === filePath || f.path === filePath.replace(/^\//, ''),
  );
  if (manifestEntry && manifestEntry.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { name: 'specs-file-too-large', data: { maxBytes: MAX_FILE_SIZE_BYTES } },
      { status: 422 },
    );
  }

  // Check the file cache before hitting the filesystem.
  const fileCacheKey = resolved.absolutePath;
  const cachedFile = specsFileCache.get(fileCacheKey);
  if (cachedFile && specsReadDeps.now().getTime() - cachedFile.cachedAtMs < FILE_CACHE_TTL_MS) {
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === `"${cachedFile.etag}"`) {
      return new Response(null, { status: 304 });
    }
    return Response.json(
      { data: { path: filePath, content: cachedFile.content } },
      { headers: { ETag: `"${cachedFile.etag}"`, 'Cache-Control': 'private, max-age=300' } },
    );
  }

  // Deduplicate concurrent reads for the same file.
  const inflight = specsFileInflight.get(fileCacheKey);
  const fileResult = await (inflight ?? (() => {
    const task = specsReadDeps.readSpecsFile({ absolutePath: resolved.absolutePath })
      .then((r) => {
        specsFileCache.set(fileCacheKey, {
          content: r.content,
          etag: r.etag,
          cachedAtMs: specsReadDeps.now().getTime(),
        });
        return { content: r.content, etag: r.etag };
      })
      .finally(() => {
        specsFileInflight.delete(fileCacheKey);
      });
    specsFileInflight.set(fileCacheKey, task);
    return task;
  })());

  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch === `"${fileResult.etag}"`) {
    return new Response(null, { status: 304 });
  }

  return Response.json(
    { data: { path: filePath, content: fileResult.content } },
    { headers: { ETag: `"${fileResult.etag}"`, 'Cache-Control': 'private, max-age=300' } },
  );
}
