// POST /api/v1/cards/:cardId/ai/edit — creates a new AI edit run.
// Sprint 175 — handler for the edit orchestrator endpoint.
// [why] After creating the run in REQUESTED status, triggers the full
// execution pipeline asynchronously (context gather → file scope → create → edit → commit).
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { createEditRun } from '../../mods/persistence';
import { runPipeline } from '../../mods/orchestrator';
import type { EditRequestInput } from '../../types';

export const editApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  createEditRun,
  /** The orchestrator pipeline — injected for testability. */
  runPipeline,
};

/**
 * Handle POST /api/v1/cards/:cardId/ai/edit.
 * [why] Authenticates the caller, validates workspace membership, parses the
 * intent from the body, creates an EditRun in REQUESTED status, and triggers
 * the full orchestrator pipeline asynchronously.
 * The caller receives the run immediately and can poll for status updates.
 */
export async function handleCreateEditRun(req: Request, cardId: string): Promise<Response> {
  // 1. Authenticate the caller
  const authError = await editApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;

  // 2. Require workspace membership
  const membershipError = await editApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? ''
  );
  if (membershipError) return membershipError;

  // 3. Parse and validate request body
  let body: { intent?: string; snapshotId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  if (typeof body.intent !== 'string' || body.intent.trim() === '') {
    return Response.json(
      {
        name: 'missing-intent',
        data: { message: 'intent is required and must be a non-empty string' },
      },
      { status: 400 }
    );
  }

  const userId = (workspaceReq as { currentUser?: { id: string } }).currentUser?.id;
  if (!userId) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'User identity not found' } },
      { status: 401 }
    );
  }

  const intent = body.intent.trim();

  // 4. Create the edit run
  try {
    const result = await editApiDeps.createEditRun({
      cardId,
      workspaceId: workspaceReq.workspaceId ?? '',
      userId,
      intent,
      snapshotId: body.snapshotId,
    });

    const { run } = result.data;

    // 5. Trigger the full orchestrator pipeline asynchronously
    // [why] Fire-and-forget — the pipeline runs in the background and
    // updates the run status as it progresses. The caller can poll
    // GET /api/v1/cards/:cardId/ai/edit/:runId for progress.
    if (typeof editApiDeps.runPipeline === 'function') {
      editApiDeps.runPipeline({ run, intent }).catch((err) => {
        console.error(
          '[aiEditOrchestrator/edit] Pipeline error for run %s:',
          run.id,
          err instanceof Error ? err.message : String(err)
        );
      });
    }

    return Response.json({ data: { run } }, { status: 201 });
  } catch (error) {
    console.error(
      '[aiEditOrchestrator/edit] Unexpected error:',
      error instanceof Error ? error.message : String(error)
    );
    return Response.json(
      { name: 'internal-error', data: { message: 'Failed to create edit run' } },
      { status: 500 }
    );
  }
}
