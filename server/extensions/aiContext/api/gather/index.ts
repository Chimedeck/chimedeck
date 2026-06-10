// POST /api/v1/cards/:cardId/ai/context/gather
// Sprint 174 — gather multi-source context for a card.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { runGatherPipeline } from '../../mods/gather';
import type { ContextGatherInput } from '../../types';

export const gatherApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  runGatherPipeline,
};

export async function handleGatherContext(req: Request, cardId: string): Promise<Response> {
  // 1. Authenticate the caller
  const authError = await gatherApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;

  // 2. Require workspace membership
  const membershipError = await gatherApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  // 3. Parse and validate request body
  let body: { intent?: string; focusPaths?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 },
    );
  }

  if (typeof body.intent !== 'string' || body.intent.trim() === '') {
    return Response.json(
      { name: 'missing-intent', data: { message: 'intent is required and must be a non-empty string' } },
      { status: 400 },
    );
  }

  // 4. Build input and run the pipeline
  const input: ContextGatherInput = {
    cardId,
    intent: body.intent.trim(),
    focusPaths: body.focusPaths ?? undefined,
  };

  try {
    const result = await gatherApiDeps.runGatherPipeline(input);

    if (result.status !== 200) {
      return Response.json(
        { name: result.name ?? 'gather-failed', data: { message: result.message ?? 'Context gathering failed' } },
        { status: result.status },
      );
    }

    return Response.json(
      { data: result.data },
      { status: 200 },
    );
  } catch (error) {
    console.error('[aiContext/gather] Unexpected error:', error instanceof Error ? error.message : String(error));
    return Response.json(
      { name: 'internal-error', data: { message: 'Context gathering failed unexpectedly' } },
      { status: 500 },
    );
  }
}
