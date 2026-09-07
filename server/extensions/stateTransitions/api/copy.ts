import { db } from '../../../common/db';
import { generateId } from '../../../common/uuid';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { featureFlags } from '../../../config/featureFlags';
import { toGraphResponse } from '../common/serializer';
import type { StateTransitionGraph } from '../common/types';
import { stateTransitionError } from '../common/errors';
import { validateGraphShape } from '../common/validator';

type CopyBody = {
  targetBoardId?: unknown;
  copyEnabled?: unknown;
};

type BoardRow = {
  id: string;
  workspace_id: string;
};

type ListRow = {
  id: string;
  title: string;
};

type TransitionRow = {
  id: string;
  board_id: string;
  enabled: boolean;
  graph_data: StateTransitionGraph;
  updated_at: string;
};

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

async function isBoardAdminOrOwner(userId: string, boardId: string): Promise<boolean> {
  const boardMember = await db('board_members')
    .where({ board_id: boardId, user_id: userId })
    .first() as { role?: string } | undefined;
  const role = boardMember?.role;
  return role === 'ADMIN' || role === 'OWNER';
}

function remapGraphByListName(
  sourceGraph: StateTransitionGraph,
  targetLists: ListRow[],
): StateTransitionGraph {
  const targetListByName = new Map<string, ListRow>();
  for (const list of targetLists) {
    const key = normalizeName(list.title);
    if (!targetListByName.has(key)) {
      targetListByName.set(key, list);
    }
  }

  const sourceToTargetNodeId = new Map<string, string>();
  const nodes = sourceGraph.nodes.flatMap((node) => {
    const matchedList = targetListByName.get(normalizeName(node.label));
    if (!matchedList) return [];
    sourceToTargetNodeId.set(node.id, matchedList.id);
    return [
      {
        ...node,
        id: matchedList.id,
        listId: matchedList.id,
        label: matchedList.title,
      },
    ];
  });

  const edges = sourceGraph.edges.flatMap((edge) => {
    const fromNodeId = sourceToTargetNodeId.get(edge.fromNodeId);
    const toNodeId = sourceToTargetNodeId.get(edge.toNodeId);
    if (!fromNodeId || !toNodeId) return [];
    return [
      {
        ...edge,
        fromNodeId,
        toNodeId,
      },
    ];
  });

  return {
    nodes,
    edges,
    notes: sourceGraph.notes.map((note) => ({ ...note })),
  };
}

export async function handleCopyStateTransitions(req: Request, sourceBoardId: string): Promise<Response> {
  if (!featureFlags.STATE_TRANSITIONS_ENABLED) {
    return Response.json(
      stateTransitionError('not-implemented', { message: 'State transitions feature is not enabled' }),
      { status: 501 },
    );
  }

  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const currentUserId = (req as AuthenticatedRequest).currentUser?.id;
  if (!currentUserId) {
    return Response.json(
      stateTransitionError('unauthorized', { message: 'Authentication required' }),
      { status: 401 },
    );
  }

  let body: CopyBody = {};
  try {
    const raw = await req.text();
    body = raw ? (JSON.parse(raw) as CopyBody) : {};
  } catch {
    return Response.json(
      stateTransitionError('bad-request', { message: 'Invalid JSON body' }),
      { status: 400 },
    );
  }

  if (typeof body.targetBoardId !== 'string' || body.targetBoardId.trim() === '') {
    return Response.json(
      stateTransitionError('bad-request', { message: 'targetBoardId is required' }),
      { status: 400 },
    );
  }
  if (body.copyEnabled !== undefined && typeof body.copyEnabled !== 'boolean') {
    return Response.json(
      stateTransitionError('bad-request', { message: 'copyEnabled must be a boolean when provided' }),
      { status: 400 },
    );
  }
  const copyEnabled = body.copyEnabled ?? true;

  const sourceBoard = await db('boards')
    .where({ id: sourceBoardId })
    .first() as BoardRow | undefined;
  const targetBoard = await db('boards')
    .where({ id: body.targetBoardId })
    .first() as BoardRow | undefined;

  if (!sourceBoard || !targetBoard) {
    return Response.json(
      stateTransitionError('state-transition-copy-target-not-found', {}),
      { status: 422 },
    );
  }

  const [isSourceAdmin, isTargetAdmin] = await Promise.all([
    isBoardAdminOrOwner(currentUserId, sourceBoard.id),
    isBoardAdminOrOwner(currentUserId, targetBoard.id),
  ]);
  if (!isSourceAdmin || !isTargetAdmin) {
    return Response.json(
      stateTransitionError('state-transition-copy-insufficient-permission', {}),
      { status: 422 },
    );
  }

  const sourceRow = await db('board_state_transitions')
    .where({ board_id: sourceBoard.id })
    .first() as TransitionRow | undefined;
  if (!sourceRow) {
    return Response.json(
      stateTransitionError('state-transition-copy-no-source', {}),
      { status: 422 },
    );
  }
  const graphValidation = validateGraphShape(sourceRow.graph_data);
  if (!graphValidation.ok) {
    return Response.json(
      stateTransitionError('state-transition-graph-invalid', { message: graphValidation.message }),
      { status: 422 },
    );
  }

  const targetLists = await db('lists')
    .where({ board_id: targetBoard.id, archived: false })
    .orderBy('position', 'asc')
    .select('id', 'title') as ListRow[];

  const copiedGraph = remapGraphByListName(graphValidation.graph, targetLists);
  const skippedNodes = Math.max(0, graphValidation.graph.nodes.length - copiedGraph.nodes.length);
  const existingTargetRow = await db('board_state_transitions')
    .where({ board_id: targetBoard.id })
    .first() as TransitionRow | undefined;
  const nextUpdatedAt = new Date().toISOString();
  const targetEnabled = copyEnabled
    ? sourceRow.enabled
    : (existingTargetRow?.enabled ?? false);

  const savedRows = existingTargetRow
    ? await db('board_state_transitions')
      .where({ board_id: targetBoard.id })
      .update(
        {
          enabled: targetEnabled,
          graph_data: copiedGraph,
          updated_at: nextUpdatedAt,
        },
        ['*'],
      ) as TransitionRow[]
    : await db('board_state_transitions')
      .insert({
        id: generateId(),
        board_id: targetBoard.id,
        enabled: targetEnabled,
        graph_data: copiedGraph,
        updated_at: nextUpdatedAt,
      })
      .returning('*') as TransitionRow[];

  const saved = savedRows[0];
  if (!saved) {
    return Response.json(
      stateTransitionError('state-transition-copy-failed', { message: 'State transitions could not be copied' }),
      { status: 500 },
    );
  }

  return Response.json({
    ...toGraphResponse({
      boardId: targetBoard.id,
      enabled: saved.enabled,
      graph: saved.graph_data,
      updatedAt: saved.updated_at,
    }),
    metadata: {
      skippedNodes,
      copyEnabled,
    },
  });
}
