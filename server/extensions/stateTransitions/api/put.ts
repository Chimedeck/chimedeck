import { db } from '../../../common/db';
import { generateId } from '../../../common/uuid';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireRole,
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import {
  requireBoardWritable,
  type BoardScopedRequest,
} from '../../board/middlewares/requireBoardWritable';
import { featureFlags } from '../../../config/featureFlags';
import {
  createDefaultGraphFromLists,
  createEmptyGraph,
  deserializeGraphData,
  toGraphResponse,
} from '../common/serializer';
import {
  findMissingNodeForBoardList,
  findOutOfSyncNodeLabel,
  findUnknownNodeListId,
  validateGraphShape,
} from '../common/validator';
import type { StateTransitionGraph } from '../common/types';
import { stateTransitionError } from '../common/errors';
import { broadcastStateTransitionUpdated } from '../common/ws';
import { syncGraphWithLists } from '../common/sync';

type TransitionRow = {
  id: string;
  board_id: string;
  enabled: boolean;
  graph_data: StateTransitionGraph;
  updated_at: string;
};

type PutBody = {
  enabled?: unknown;
  graph?: unknown;
};

export async function handlePutStateTransitions(req: Request, boardId: string): Promise<Response> {
  if (!featureFlags.STATE_TRANSITIONS_ENABLED) {
    return Response.json(
      stateTransitionError('not-implemented', {
        message: 'State transitions feature is not enabled',
      }),
      { status: 501 }
    );
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardReq, boardId);
  if (writableError) {
    if (writableError.status === 404) {
      return Response.json(
        stateTransitionError('board-not-found', { message: 'Board not found' }),
        { status: 404 }
      );
    }
    return writableError;
  }

  const board = boardReq.board;
  if (!board) {
    return Response.json(stateTransitionError('board-not-found', { message: 'Board not found' }), {
      status: 404,
    });
  }
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const workspaceRoleError = requireRole(scopedReq, 'ADMIN');
  if (workspaceRoleError) {
    const currentUserId = (req as AuthenticatedRequest).currentUser?.id;
    const actingBoardMember = currentUserId
      ? ((await db('board_members')
          .where({ board_id: board.id, user_id: currentUserId })
          .first()) as { role?: string } | undefined)
      : undefined;

    const actingBoardRole = actingBoardMember?.role;
    const isBoardAdmin = actingBoardRole === 'ADMIN' || actingBoardRole === 'OWNER';
    if (!isBoardAdmin) return workspaceRoleError;
  }

  let body: PutBody = {};
  try {
    const raw = await req.text();
    body = raw ? (JSON.parse(raw) as PutBody) : {};
  } catch {
    return Response.json(stateTransitionError('bad-request', { message: 'Invalid JSON body' }), {
      status: 400,
    });
  }

  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    return Response.json(
      stateTransitionError('bad-request', { message: 'enabled must be a boolean when provided' }),
      { status: 400 }
    );
  }

  let validatedGraph: StateTransitionGraph | undefined;
  if (body.graph !== undefined) {
    const graphValidation = validateGraphShape(body.graph);
    if (!graphValidation.ok) {
      return Response.json(
        stateTransitionError('state-transition-graph-invalid', {
          message: graphValidation.message,
        }),
        { status: 422 }
      );
    }
    validatedGraph = graphValidation.graph;
  }

  const activeLists = (await db('lists')
    .where({ board_id: board.id, archived: false })
    .orderBy('position', 'asc')
    .select('id', 'title')) as Array<{ id: string; title: string }>;

  if (validatedGraph) {
    const listIds = new Set(activeLists.map((list) => list.id));
    const unknownNodeId = findUnknownNodeListId(validatedGraph, listIds);
    if (unknownNodeId) {
      return Response.json(
        stateTransitionError('state-transition-node-unknown-list', { nodeId: unknownNodeId }),
        { status: 422 }
      );
    }

    const missingListId = findMissingNodeForBoardList(validatedGraph, listIds);
    if (missingListId) {
      return Response.json(
        stateTransitionError('state-transition-graph-out-of-sync', {
          listId: missingListId,
          message: `graph is missing node for list ${missingListId}`,
        }),
        { status: 422 }
      );
    }

    const outOfSyncNodeLabel = findOutOfSyncNodeLabel(
      validatedGraph,
      new Map(activeLists.map((list) => [list.id, list]))
    );
    if (outOfSyncNodeLabel) {
      return Response.json(
        stateTransitionError('state-transition-graph-out-of-sync', {
          nodeId: outOfSyncNodeLabel.nodeId,
          listId: outOfSyncNodeLabel.listId,
          expectedLabel: outOfSyncNodeLabel.expectedLabel,
          receivedLabel: outOfSyncNodeLabel.receivedLabel,
          message: 'graph node labels must match current board list titles',
        }),
        { status: 422 }
      );
    }
  }

  let row = (await db('board_state_transitions').where({ board_id: board.id }).first()) as
    | TransitionRow
    | undefined;

  if (!row) {
    const defaultGraph = createDefaultGraphFromLists(activeLists);
    const insertedRows = (await db('board_state_transitions')
      .insert({
        id: generateId(),
        board_id: board.id,
        enabled: false,
        graph_data: defaultGraph,
      })
      .returning('*')) as TransitionRow[];
    row = insertedRows[0];
  }

  const persistedRow = row ?? {
    enabled: false,
    graph_data: createEmptyGraph(),
  };
  const persistedGraph =
    deserializeGraphData(persistedRow.graph_data) ?? createDefaultGraphFromLists(activeLists);
  const syncedPersistedGraph = syncGraphWithLists(persistedGraph, activeLists).graph;
  const nextGraph = validatedGraph ?? syncedPersistedGraph;
  const nextEnabled = typeof body.enabled === 'boolean' ? body.enabled : persistedRow.enabled;

  const updatedRows = (await db('board_state_transitions').where({ board_id: board.id }).update(
    {
      enabled: nextEnabled,
      graph_data: nextGraph,
      updated_at: new Date().toISOString(),
    },
    ['*']
  )) as TransitionRow[];

  const saved = updatedRows[0];
  if (!saved) {
    return Response.json(
      stateTransitionError('state-transition-update-failed', {
        message: 'State transitions could not be updated',
      }),
      { status: 500 }
    );
  }

  await broadcastStateTransitionUpdated({
    boardId: board.id,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
    enabled: saved.enabled,
    graph: saved.graph_data,
    updatedAt: saved.updated_at,
  });

  return Response.json(
    toGraphResponse({
      boardId: board.id,
      enabled: saved.enabled,
      graph: saved.graph_data,
      updatedAt: saved.updated_at,
    })
  );
}
