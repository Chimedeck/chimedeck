import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireRole,
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { writeActivity } from '../../../activity/mods/write';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import { normalizeGithubProjectUrl, toGithubProjectAuditValue } from '../../mods/githubProjectUrl';

interface PatchBoardIntegrationsBody {
  github_project_url?: unknown;
  github_branch?: unknown;
}

// [why] Mirror `git check-ref-format --branch` so a persisted branch never fails at
// checkout time. Rules implemented (git check-ref-format(1)):
// - non-empty, ≤255 chars
// - no space, no ASCII control chars, no ~ ^ : ? * [ \
// - no '..' sequence, no '@{', not a single '@'
// - no component starting with '.', no component ending with '.lock' (case-insensitive)
// - no leading '-' or '/', no trailing '/', no '//' (empty component)
export function isValidGitBranchName(value: string): boolean {
  if (value.length === 0 || value.length > 255) return false;
  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(value)) return false;
  if (value.includes('..')) return false;
  if (value.includes('@{')) return false;
  if (value === '@') return false;
  if (/\.lock$/i.test(value)) return false;
  if (/^[-/]/.test(value)) return false;
  if (/\.$/.test(value)) return false;
  if (value.includes('//')) return false;
  if (value.endsWith('/')) return false;  // empty final component (e.g. 'feature/')
  if (/(^|\/)\./.test(value)) return false;
  // Any path component ENDING in '.lock' is off-limits (case-insensitive), which is
  // git's actual rule; a component merely CONTAINING 'LOCK' ('feature/LOCK/qux') is legal.
  if (value.split('/').some((c) => /\.lock$/i.test(c))) return false;
  return true;
}

function toForwardedIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return null;
  const first = forwarded.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export async function handlePatchBoardIntegrations(
  req: Request,
  boardId: string
): Promise<Response> {
  try {
    const authError = await authenticate(req as AuthenticatedRequest);
    if (authError) return authError;

    const boardReq = req as BoardScopedRequest;
    const accessError = await requireBoardAccess(boardReq, boardId);
    if (accessError) return accessError;

    const workspaceReq = req as WorkspaceScopedRequest;
    const membershipError = await requireWorkspaceMembership(
      workspaceReq,
      boardReq.board!.workspace_id
    );
    if (membershipError) return membershipError;

    const roleError = requireRole(workspaceReq, 'ADMIN');
    if (roleError) return roleError;

    let body: PatchBoardIntegrationsBody;
    try {
      body = (await req.json()) as PatchBoardIntegrationsBody;
    } catch {
      return Response.json(
        { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
        { status: 400 }
      );
    }

    // [why] At least one of github_project_url or github_branch must be present
    // in the body. Previously only github_project_url was required.
    if (!('github_project_url' in body) && !('github_branch' in body)) {
      return Response.json(
        {
          name: 'missing-integration-field',
          data: { message: 'At least one of github_project_url or github_branch is required' },
        },
        { status: 400 }
      );
    }

    const currentUrl =
      (boardReq.board as { github_project_url?: string | null }).github_project_url ?? null;
    const currentBranch =
      (boardReq.board as { github_branch?: string | null }).github_branch ?? null;

    let nextUrl: string | null = currentUrl;
    let nextAuditValue = { hash: null, reference: null } as ReturnType<
      typeof toGithubProjectAuditValue
    >;
    let nextBranch: string | null = currentBranch;
    let urlChanged = false;
    let branchChanged = false;

    // ── Process github_project_url ──
    if ('github_project_url' in body) {
      if (body.github_project_url !== null) {
        if (typeof body.github_project_url !== 'string') {
          return Response.json(
            {
              name: 'invalid-github-project-url',
              data: { message: 'github_project_url must be a string or null' },
            },
            { status: 422 }
          );
        }

        const normalized = normalizeGithubProjectUrl({ value: body.github_project_url });
        if (!normalized.ok) {
          return Response.json(
            { name: 'invalid-github-project-url', data: { message: normalized.message } },
            { status: 422 }
          );
        }

        nextUrl = normalized.value.normalizedUrl;
        nextAuditValue = {
          hash: normalized.value.hash,
          reference: normalized.value.reference,
        };
      } else {
        nextUrl = null;
      }
      urlChanged = currentUrl !== nextUrl;
    }

    // ── Process github_branch ──
    if ('github_branch' in body) {
      if (body.github_branch !== null) {
        if (typeof body.github_branch !== 'string') {
          return Response.json(
            {
              name: 'invalid-github-branch',
              data: { message: 'github_branch must be a string or null' },
            },
            { status: 422 }
          );
        }
        const trimmed = body.github_branch.trim();
        if (!isValidGitBranchName(trimmed)) {
          return Response.json(
            {
              name: 'invalid-github-branch',
              data: { message: 'github_branch contains invalid characters or patterns' },
            },
            { status: 422 }
          );
        }
        nextBranch = trimmed;
      } else {
        nextBranch = null;
      }
      branchChanged = currentBranch !== nextBranch;
    }

    // [why] Short-circuit when nothing actually changed — avoids a no-op DB write
    // and spurious activity entry.
    if (!urlChanged && !branchChanged) {
      return Response.json({
        data: {
          github_project_url: nextUrl,
          github_branch: nextBranch,
        },
      });
    }

    const updateFields: Record<string, string | null> = {};
    if (urlChanged) updateFields.github_project_url = nextUrl;
    if (branchChanged) updateFields.github_branch = nextBranch;
    await db('boards').where({ id: boardId }).update(updateFields);

    const changedAt = new Date().toISOString();
    const actorId = (req as AuthenticatedRequest).currentUser!.id;

    // [why] Write separate activity entries for URL and branch changes so the
    // audit trail is clear about what changed.
    if (urlChanged) {
      await writeActivity({
        entityType: 'board',
        entityId: boardId,
        boardId,
        action: 'board_github_project_url_updated',
        actorId,
        payload: {
          previous: toGithubProjectAuditValue({ url: currentUrl }),
          next: nextAuditValue,
          actorId,
          changedAt,
        },
        ipAddress: toForwardedIp(req),
        userAgent: req.headers.get('user-agent'),
      });
    }

    if (branchChanged) {
      await writeActivity({
        entityType: 'board',
        entityId: boardId,
        boardId,
        action: 'board_github_branch_updated',
        actorId,
        payload: {
          previous: currentBranch,
          next: nextBranch,
          actorId,
          changedAt,
        },
        ipAddress: toForwardedIp(req),
        userAgent: req.headers.get('user-agent'),
      });
    }

    boardReq.board = {
      ...boardReq.board!,
      github_project_url: nextUrl,
      github_branch: nextBranch,
    };

    return Response.json({
      data: {
        github_project_url: nextUrl,
        github_branch: nextBranch,
      },
    });
  } catch (error) {
    // [why] Never forward a raw exception message to the client — DB/driver
    // failures would expose schema or internal diagnostics. Log details here,
    // return a fixed public message.
    console.error('[500] PATCH /settings/integrations:', error);
    return Response.json(
      { name: 'internal-server-error', data: { message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
