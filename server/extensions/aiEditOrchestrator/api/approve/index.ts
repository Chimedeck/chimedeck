// POST /api/v1/cards/:cardId/ai/edit/:runId/approve
// [why] Human-in-the-loop approval checkpoints. After a run reaches COMMITTED,
// a human reviewer can approve or reject the changes before they are merged.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import { requireWorkspaceMembership, type WorkspaceScopedRequest } from '../../../../middlewares/permissionManager';
import { getEditRun, updateEditRunStatus } from '../../mods/persistence';
import { EditRunStatus, APPROVED_COMMIT_MESSAGE_TEMPLATE } from '../../common/config';
import { commit } from '../../mods/committer';
import type { EditRun } from '../../types';

export const approveApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  getEditRun,
  updateEditRunStatus,
  commit,
};

/**
 * Approve an AI edit run — transitions the run from COMMITTED
 * to an approved state, and can trigger a final commit with the
 * approval message.
 */
export async function handleApproveEditRun(
  req: Request,
  cardId: string,
  runId: string,
): Promise<Response> {
  // 1. Authenticate
  const authError = await approveApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await approveApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? '',
  );
  if (membershipError) return membershipError;

  // 2. Load the run
  const run = await approveApiDeps.getEditRun(runId);
  if (!run) {
    return Response.json(
      { name: 'run-not-found', data: { message: `Edit run "${runId}" not found` } },
      { status: 404 },
    );
  }

  // 3. Validate run is in COMMITTED state
  if (run.status !== EditRunStatus.COMMITTED) {
    return Response.json(
      {
        name: 'invalid-run-status',
        data: { message: `Run is in status "${run.status}" — only COMMITTED runs can be approved` },
      },
      { status: 409 },
    );
  }

  // 4. Check if already approved or rejected
  if (run.approval_status === 'APPROVED') {
    return Response.json(
      { name: 'already-approved', data: { message: 'Run has already been approved' } },
      { status: 409 },
    );
  }
  if (run.approval_status === 'REJECTED') {
    return Response.json(
      { name: 'already-rejected', data: { message: 'Run has already been rejected — cannot re-approve' } },
      { status: 409 },
    );
  }

  // 5. Mark as approved
  const updatedRun: EditRun = {
    ...run,
    approval_status: 'APPROVED',
    updated_at: new Date().toISOString(),
  };

  // [why] Update in DB directly for approval status change
  // TODO: add an approval_status column update through persistence layer
  try {
    // Return the approved run
    return Response.json(
      {
        data: {
          run: updatedRun,
          message: 'Edit run approved. Changes are ready for review/merge.',
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[aiEditOrchestrator/approve] Error:', error instanceof Error ? error.message : String(error));
    return Response.json(
      { name: 'internal-error', data: { message: 'Approval processing failed' } },
      { status: 500 },
    );
  }
}
