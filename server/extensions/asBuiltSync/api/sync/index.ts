// As-Built Sync handler (Sprint 176).
// [why] POST /api/v1/cards/:cardId/as-built/sync — validates auth,
// workspace membership, card existence, and creates an as-built sync
// run that executes asynchronously. Follows the sprintGeneration
// handleGenerateSprint pattern.

import { db } from '../../../../common/db';
import { createAsBuiltSyncRun, hasSucceededAsBuiltRun } from '../../mods/persistence';
import { emitAsBuiltStarted } from '../../mods/activities';

export const syncAsBuiltDeps = {
  db,
  createAsBuiltSyncRun,
  hasSucceededAsBuiltRun,
  emitAsBuiltStarted,
};

/**
 * Handle POST /api/v1/cards/:cardId/as-built/sync.
 */
export async function handleSyncAsBuilt(
  req: Request,
  cardId: string,
): Promise<Response> {
  // Extract user from auth context (set by boardVisibility middleware)
  const userId = (req as { currentUser?: { id: string } }).currentUser?.id;
  if (!userId) {
    return Response.json(
      {
        name: 'unauthorized',
        data: { message: 'Authentication required' },
      },
      { status: 401 },
    );
  }

  // Get workspace and board from the request context
  const workspaceId = (req as { workspaceId?: string }).workspaceId;
  if (!workspaceId) {
    return Response.json(
      {
        name: 'workspace-not-found',
        data: { message: 'Workspace context not found' },
      },
      { status: 400 },
    );
  }

  // Verify the card exists and belongs to this workspace
  try {
    const card = await syncAsBuiltDeps.db('cards')
      .join('lists', 'cards.list_id', 'lists.id')
      .join('boards', 'lists.board_id', 'boards.id')
      .where({ 'cards.id': cardId, 'boards.workspace_id': workspaceId })
      .select('cards.id', 'lists.board_id', 'cards.title')
      .first();

    if (!card) {
      return Response.json(
        {
          name: 'card-not-found',
          data: { message: 'Card not found in this workspace' },
        },
        { status: 404 },
      );
    }

    const boardId = card.board_id as string;

    // Check for existing succeeded runs (idempotency guard)
    const alreadySynced = await syncAsBuiltDeps.hasSucceededAsBuiltRun(cardId);
    if (alreadySynced) {
      return Response.json(
        {
          name: 'as-built-already-synced',
          data: {
            message:
              'An as-built sync run has already succeeded for this card. Move to another phase and back to re-trigger.',
          },
        },
        { status: 409 },
      );
    }

    // Create the run in QUEUED status
    const run = await syncAsBuiltDeps.createAsBuiltSyncRun({
      cardId,
      workspaceId,
      userId,
      triggerRunId: null, // Direct API call, not trigger-initiated
    });

    // Emit started event
    try {
      await syncAsBuiltDeps.emitAsBuiltStarted({
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
    import('../../mods/pipeline').then(
      ({ runAsBuiltSyncPipeline }) => {
        runAsBuiltSyncPipeline({
          cardId,
          workspaceId,
          boardId,
          userId,
          triggerRunId: null,
        }).catch((err) => {
          console.error(
            `[asBuiltSync/api/sync] Pipeline failed for run ${run.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        });
      },
    );

    return Response.json(
      {
        data: {
          run: {
            ...run,
            // Don't expose internal evidence in the response
            evidence: undefined,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[asBuiltSync/api/sync] Error:',
      error instanceof Error ? error.message : String(error),
    );
    return Response.json(
      {
        name: 'internal-error',
        data: { message: 'Internal server error' },
      },
      { status: 500 },
    );
  }
}
