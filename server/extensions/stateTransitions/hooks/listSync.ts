import { db } from '../../../common/db';
import { renameNodeLabel, stripDeletedNodes } from '../common/sync';
import type {
  StateTransitionGraph,
  StateTransitionListLike,
  StateTransitionListSyncReason,
  StateTransitionListSyncResult,
} from '../common/types';

type TransitionRow = {
  board_id: string;
  graph_data: StateTransitionGraph;
};

async function syncListChange({
  boardId,
  reason,
  transform,
}: {
  boardId: string;
  reason: StateTransitionListSyncReason;
  transform: (graph: StateTransitionGraph, activeLists: StateTransitionListLike[]) => StateTransitionGraph;
}): Promise<StateTransitionListSyncResult> {
  const transitionRow = await db('board_state_transitions')
    .where({ board_id: boardId })
    .first() as TransitionRow | undefined;

  if (!transitionRow) {
    return { boardId, reason, updated: false };
  }

  const activeLists = await db('lists')
    .where({ board_id: boardId, archived: false })
    .orderBy('position', 'asc')
    .select('id', 'title') as StateTransitionListLike[];

  const nextGraph = transform(transitionRow.graph_data, activeLists);
  const changed = JSON.stringify(nextGraph) !== JSON.stringify(transitionRow.graph_data);

  if (!changed) {
    return { boardId, reason, updated: false };
  }

  await db('board_state_transitions')
    .where({ board_id: boardId })
    .update({
      graph_data: nextGraph,
      updated_at: new Date().toISOString(),
    });

  return { boardId, reason, updated: true };
}

export async function syncStateTransitionsOnListRename(
  boardId: string,
): Promise<StateTransitionListSyncResult> {
  return syncListChange({
    boardId,
    reason: 'list-renamed',
    transform: renameNodeLabel,
  });
}

export async function syncStateTransitionsOnListDelete(
  boardId: string,
): Promise<StateTransitionListSyncResult> {
  return syncListChange({
    boardId,
    reason: 'list-deleted',
    transform: stripDeletedNodes,
  });
}
