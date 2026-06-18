// POST /api/v1/cards/:cardId/ai/edit/:runId/reject
// [why] Human-in-the-loop rejection: a reviewer can reject an AI edit run,
// transitioning it to FAILED state with the rejection reason.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { getEditRun, updateEditRunStatus } from '../../mods/persistence';
import { EditRunStatus } from '../../common/config';
import type { EditRun } from '../../types';

export const rejectApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  getEditRun,
  updateEditRunStatus,
};

/**
 * Reject an AI edit run — transitions the run to FAILED with the
 * rejection reason as the error message.
 */
export async function handleRejectEditRun(
  req: Request,
  cardId: string,
  runId: string
): Promise<Response> {
  // 1. Authenticate
  const authError = await rejectApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const workspaceReq = req as WorkspaceScopedRequest;
  const membershipError = await rejectApiDeps.requireWorkspaceMembership(
    workspaceReq,
    workspaceReq.workspaceId ?? ''
  );
  if (membershipError) return membershipError;

  // 2. Parse rejection reason
  let body: { reason?: string; comment?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be JSON' } },
      { status: 400 }
    );
  }

  if (typeof body.reason !== 'string' || body.reason.trim() === '') {
    return Response.json(
      {
        name: 'missing-reason',
        data: { message: 'reason is required and must be a non-empty string' },
      },
      { status: 400 }
    );
  }

  // 3. Load the run
  const run = await rejectApiDeps.getEditRun(runId);
  if (!run) {
    return Response.json(
      { name: 'run-not-found', data: { message: `Edit run "${runId}" not found` } },
      { status: 404 }
    );
  }

  // 4. Validate run is in an approvable state (FILE_SCOPE_PLANNED or COMMITTED)
  // [why] The human-in-the-loop checkpoint is at FILE_SCOPE_PLANNED.
  // COMMITTED runs can also be rejected before final merge.
  const APPROVABLE_STATUSES = [
    EditRunStatus.FILE_SCOPE_PLANNED,
    EditRunStatus.COMMITTED,
  ] as string[];
  if (!APPROVABLE_STATUSES.includes(run.status)) {
    return Response.json(
      {
        name: 'invalid-run-status',
        data: {
          message: `Run is in status "${run.status}" — only FILE_SCOPE_PLANNED or COMMITTED runs can be rejected`,
        },
      },
      { status: 409 }
    );
  }

  // 5. Check if already approved or rejected
  if (run.approval_status === 'APPROVED') {
    return Response.json(
      {
        name: 'already-approved',
        data: { message: 'Run has already been approved — cannot reject' },
      },
      { status: 409 }
    );
  }
  if (run.approval_status === 'REJECTED') {
    return Response.json(
      { name: 'already-rejected', data: { message: 'Run has already been rejected' } },
      { status: 409 }
    );
  }

  // 6. Build full rejection message
  const rejectionMsg = body.comment
    ? `Rejected: ${body.reason} — ${body.comment}`
    : `Rejected: ${body.reason}`;

  // 7. Transition to FAILED
  try {
    const result = await rejectApiDeps.updateEditRunStatus({
      run,
      nextStatus: EditRunStatus.FAILED,
      errorMessage: rejectionMsg,
    });

    if (result.status !== 200) {
      return Response.json(
        { name: result.name ?? 'transition-failed', data: result.data },
        { status: result.status }
      );
    }

    // [why] Mark approval_status as REJECTED on the run
    const rejectedRun: EditRun = {
      ...('data' in result ? result.data.run : run),
      approval_status: 'REJECTED',
    };

    // [why] Update the DB with rejection status
    try {
      // TODO: add approval_status column update through persistence layer
    } catch {
      // Best effort
    }

    return Response.json(
      {
        data: {
          run: rejectedRun,
          message: `Edit run rejected: ${body.reason}`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[aiEditOrchestrator/reject] Error:',
      error instanceof Error ? error.message : String(error)
    );
    return Response.json(
      { name: 'internal-error', data: { message: 'Rejection processing failed' } },
      { status: 500 }
    );
  }
}
