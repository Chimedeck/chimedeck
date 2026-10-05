// Sprint 176 — Generate sprint handler.
// [why] POST /api/v1/cards/:cardId/sprint/generate — validates auth,
// workspace membership, card existence, and creates a sprint generation
// run that executes asynchronously.
import { db } from '../../../../common/db';
import { createSprintGenRun, hasSucceededRun } from '../../mods/persistence';
import { emitSprintGenStarted } from '../../mods/activities';
import type { GenerateSprintRequest } from '../../types';

export const generateSprintDeps = {
  db,
  createSprintGenRun,
  hasSucceededRun,
  emitSprintGenStarted,
};

/**
 * Handle POST /api/v1/cards/:cardId/sprint/generate.
 */
export async function handleGenerateSprint(req: Request, cardId: string): Promise<Response> {
  let body: GenerateSprintRequest;
  try {
    body = (await req.json()) as GenerateSprintRequest;
  } catch {
    return Response.json(
      { name: 'invalid-request-body', data: { message: 'Request body must be valid JSON' } },
      { status: 400 }
    );
  }

  // Extract user from auth context (set by boardVisibility middleware)
  const userId = (req as { currentUser?: { id: string } }).currentUser?.id;
  if (!userId) {
    return Response.json(
      { name: 'unauthorized', data: { message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // Get workspace and board from the request context
  const workspaceId = (req as { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    return Response.json(
      { name: 'workspace-not-found', data: { message: 'Workspace context not found' } },
      { status: 400 }
    );
  }

  // Verify the card exists and belongs to this workspace
  try {
    const card = await generateSprintDeps
      .db('cards')
      .join('lists', 'cards.list_id', 'lists.id')
      .join('boards', 'lists.board_id', 'boards.id')
      .where({ 'cards.id': cardId, 'boards.workspace_id': workspaceId })
      .select('cards.id', 'lists.board_id', 'cards.title')
      .first();

    if (!card) {
      return Response.json(
        { name: 'card-not-found', data: { message: 'Card not found in this workspace' } },
        { status: 404 }
      );
    }

    // Resolve board ID
    const boardId = body.boardId ?? (card.board_id as string);

    // Check for existing succeeded runs (idempotency guard)
    const alreadyGenerated = await generateSprintDeps.hasSucceededRun(cardId);
    if (alreadyGenerated) {
      return Response.json(
        {
          name: 'sprint-already-generated',
          data: {
            message:
              'A sprint generation run has already succeeded for this card. Create a new card or re-run the refinement loop.',
          },
        },
        { status: 409 }
      );
    }

    // Create the run in QUEUED status
    const run = await generateSprintDeps.createSprintGenRun({
      cardId,
      workspaceId,
      userId,
      snapshotId: body.snapshotId ?? null,
      triggerRunId: null, // Direct API call, not trigger-initiated
    });

    // Emit started event
    try {
      await generateSprintDeps.emitSprintGenStarted({
        cardId,
        boardId,
        runId: run.id,
        actorId: userId,
        payload: { source: 'api' },
      });
    } catch {
      // Fire-and-forget
    }

    // Fire async pipeline execution (fire-and-forget)
    import('../../mods/pipeline').then(({ runSprintGenerationPipeline }) => {
      runSprintGenerationPipeline({
        cardId,
        workspaceId,
        boardId,
        userId,
        triggerRunId: null,
        snapshotId: body.snapshotId ?? null,
      }).catch((err) => {
        console.error(
          `[sprintGeneration/api] Pipeline failed for run ${run.id}:`,
          err instanceof Error ? err.message : String(err)
        );
      });
    });

    return Response.json(
      {
        data: {
          run: {
            ...run,
            // Don't expose internal fields
            requirement_packet: undefined,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[sprintGeneration/api/generate] Error:',
      error instanceof Error ? error.message : String(error)
    );
    return Response.json(
      { name: 'internal-error', data: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
