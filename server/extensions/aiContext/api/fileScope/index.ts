// POST /api/v1/cards/:cardId/ai/file-scope
// Sprint 174 Part 2 — generate file create/edit/no-change plan.
import { authenticate } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { runGatherPipeline } from '../../mods/gather';
import { detectDuplicates } from '../../mods/duplicateDetection';
import { analyseImpact } from '../../mods/impactAnalysis';
import { planFileScope } from '../../mods/fileScopePlanner';
import { persistSnapshot } from '../../mods/snapshots';
import { applyBudget } from '../../mods/budget';
import type { FileScopeInput, FileScopeResponse, ContextGatherInput } from '../../types';

export const fileScopeApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  runGatherPipeline,
  detectDuplicates,
  analyseImpact,
  planFileScope,
  persistSnapshot,
  applyBudget,
};

export async function handleFileScope(req: Request, cardId: string): Promise<Response> {
  // 1. Authenticate
  const authError = await fileScopeApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;

  // 2. Require workspace membership
  const membershipError = await fileScopeApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  // 3. Parse request body
  let body: { intent?: string; focusPaths?: string[]; snapshotId?: string };
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

  try {
    // 4. Gather context first
    const gatherInput: ContextGatherInput = {
      cardId,
      intent: body.intent.trim(),
      focusPaths: body.focusPaths,
    };

    const gatherResult = await fileScopeApiDeps.runGatherPipeline(gatherInput);

    if (gatherResult.status !== 200 || !gatherResult.data) {
      return Response.json(
        { name: gatherResult.name ?? 'gather-failed', data: { message: gatherResult.message ?? 'Context gathering failed' } },
        { status: gatherResult.status },
      );
    }

    // 5. Apply budget to gathered chunks
    const { chunks, budget } = fileScopeApiDeps.applyBudget({ chunks: gatherResult.data.chunks });
    gatherResult.data.budget = budget;

    // 6. Detect duplicate cards
    const duplicateCards = await fileScopeApiDeps.detectDuplicates({
      cardId,
      intent: body.intent.trim(),
    });

    // 7. Analyse impact on specs
    const impact = fileScopeApiDeps.analyseImpact({
      cardIntent: body.intent.trim(),
      intentDescription: body.intent.trim(),
      repoRoot: process.cwd(),
    });

    // 8. Plan file scope
    const plan = fileScopeApiDeps.planFileScope({
      chunks,
      duplicateCards,
      impact,
      intent: body.intent.trim(),
    });

    // 9. Persist snapshot for traceability
    const { snapshotId } = await fileScopeApiDeps.persistSnapshot({
      cardId,
      intent: body.intent.trim(),
      gatherResponse: gatherResult.data,
      focusPaths: body.focusPaths,
    });

    // [why] Link the plan to the persisted snapshot.
    plan.snapshotId = snapshotId;

    const response: FileScopeResponse = plan;

    return Response.json(
      { data: response },
      { status: 200 },
    );
  } catch (error) {
    console.error('[aiContext/fileScope] Unexpected error:', error instanceof Error ? error.message : String(error));
    return Response.json(
      { name: 'internal-error', data: { message: 'File scope planning failed unexpectedly' } },
      { status: 500 },
    );
  }
}
