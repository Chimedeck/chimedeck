import { db } from '../../../common/db';
import { generateId } from '../../../common/uuid';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { featureFlags } from '../../../config/featureFlags';
import {
  createDefaultGraphFromLists,
  toGraphResponse,
} from '../common/serializer';
import type { StateTransitionGraph } from '../common/types';
import { stateTransitionError } from '../common/errors';
import { syncGraphWithLists } from '../common/sync';
import { coerceLegacyGraphShape, validateGraphShape } from '../common/validator';

type BoardRow = {
  id: string;
  workspace_id: string;
};

type TransitionRow = {
  id: string;
  board_id: string;
  enabled: boolean;
  graph_data: StateTransitionGraph;
  updated_at: string;
};

export async function handleGetStateTransitions(req: Request, boardId: string): Promise<Response> {
  if (!featureFlags.STATE_TRANSITIONS_ENABLED) {
    return Response.json(
      stateTransitionError('not-implemented', { message: 'State transitions feature is not enabled' }),
      { status: 501 },
    );
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const board = await db('boards').where({ id: boardId }).first() as BoardRow | undefined;
  if (!board) {
    return Response.json(
      stateTransitionError('board-not-found', { message: 'Board not found' }),
      { status: 404 },
    );
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const activeLists = await db('lists')
    .where({ board_id: board.id, archived: false })
    .orderBy('position', 'asc')
    .select('id', 'title') as Array<{ id: string; title: string }>;

  let row = await db('board_state_transitions')
    .where({ board_id: board.id })
    .first() as TransitionRow | undefined;

  if (!row) {
    const defaultGraph = createDefaultGraphFromLists(activeLists);
    const insertedRows = await db('board_state_transitions')
      .insert({
        id: generateId(),
        board_id: board.id,
        enabled: false,
        graph_data: defaultGraph,
      })
      .returning('*') as TransitionRow[];

    row = insertedRows[0];
  }

  if (row) {
    const graphValidation = validateGraphShape(row.graph_data);
    const parsedGraph = graphValidation.ok
      ? graphValidation.graph
      : coerceLegacyGraphShape(row.graph_data);

    const synchronizedGraph = parsedGraph
      ? syncGraphWithLists(parsedGraph, activeLists)
      : null;
    const shouldRepair = !parsedGraph
      || synchronizedGraph.changed
      || !graphValidation.ok;

    if (shouldRepair) {
      const fallbackGraph = createDefaultGraphFromLists(activeLists);
      const repairedGraph = synchronizedGraph?.graph ?? fallbackGraph;
      const repairedRows = await db('board_state_transitions')
        .where({ board_id: board.id })
        .update(
          {
            graph_data: repairedGraph,
            updated_at: new Date().toISOString(),
          },
          ['*'],
        ) as TransitionRow[];
      row = repairedRows[0];
    }
  }

  if (!row) {
    return Response.json(
      stateTransitionError('state-transition-load-failed', { message: 'State transitions could not be loaded' }),
      { status: 500 },
    );
  }

  const graph = row.graph_data;
  return Response.json(
    toGraphResponse({
      boardId: board.id,
      enabled: row.enabled,
      graph,
      updatedAt: row.updated_at,
    }),
  );
}
