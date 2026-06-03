import { db } from '../../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireRole,
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { writeActivity } from '../../../activity/mods/write';
import { requireBoardAccess, type BoardScopedRequest } from '../../middlewares/requireBoardAccess';
import {
  normalizeGithubProjectUrl,
  toGithubProjectAuditValue,
} from '../../mods/githubProjectUrl';

interface PatchBoardIntegrationsBody {
  github_project_url?: unknown;
}

function toForwardedIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return null;
  const first = forwarded.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export async function handlePatchBoardIntegrations(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const accessError = await requireBoardAccess(boardReq, boardId);
  if (accessError) return accessError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(workspaceReq, boardReq.board!.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(workspaceReq, 'ADMIN');
  if (roleError) return roleError;

  let body: PatchBoardIntegrationsBody;
  try {
    body = (await req.json()) as PatchBoardIntegrationsBody;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (!('github_project_url' in body)) {
    return Response.json(
      { name: 'missing-github-project-url', data: { message: 'github_project_url field is required' } },
      { status: 400 },
    );
  }

  const currentUrl = ((boardReq.board as { github_project_url?: string | null }).github_project_url ?? null);

  let nextUrl: string | null = null;
  let nextAuditValue = { hash: null, reference: null } as ReturnType<typeof toGithubProjectAuditValue>;

  if (body.github_project_url !== null) {
    if (typeof body.github_project_url !== 'string') {
      return Response.json(
        { name: 'invalid-github-project-url', data: { message: 'github_project_url must be a string or null' } },
        { status: 422 },
      );
    }

    const normalized = normalizeGithubProjectUrl({ value: body.github_project_url });
    if (!normalized.ok) {
      return Response.json(
        { name: 'invalid-github-project-url', data: { message: normalized.message } },
        { status: 422 },
      );
    }

    nextUrl = normalized.value.normalizedUrl;
    nextAuditValue = {
      hash: normalized.value.hash,
      reference: normalized.value.reference,
    };
  }

  if (currentUrl === nextUrl) {
    return Response.json({ data: { github_project_url: nextUrl } });
  }

  await db('boards')
    .where({ id: boardId })
    .update({ github_project_url: nextUrl });

  const changedAt = new Date().toISOString();
  const actorId = (req as AuthenticatedRequest).currentUser!.id;

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

  boardReq.board = {
    ...boardReq.board!,
    github_project_url: nextUrl,
  };

  return Response.json({
    data: {
      github_project_url: nextUrl,
    },
  });
}
