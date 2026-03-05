// Validates that a given resourceId (card or list) belongs to the specified boardId.
// Throws a structured error for mismatches; no-ops for board/member scopes.
import { db } from '../../../common/db';

type Scope = 'card' | 'list' | 'board' | 'member';

export class ResourceBoardMismatchError extends Error {
  constructor(public readonly scope: Scope, public readonly resourceId: string, public readonly boardId: string) {
    super(`${scope} '${resourceId}' does not belong to board '${boardId}'`);
    this.name = 'resource-board-mismatch';
  }
}

export async function validateResourceBelongsToBoard(
  scope: Scope,
  resourceId: string,
  boardId: string,
): Promise<void> {
  if (scope === 'board') {
    // For board scope the resourceId IS the boardId
    if (resourceId !== boardId) {
      throw new ResourceBoardMismatchError(scope, resourceId, boardId);
    }
    return;
  }

  if (scope === 'list') {
    const list = await db('lists').where({ id: resourceId, board_id: boardId }).first();
    if (!list) throw new ResourceBoardMismatchError(scope, resourceId, boardId);
    return;
  }

  if (scope === 'card') {
    // cards don't have a direct board_id — join through lists
    const card = await db('cards')
      .join('lists', 'cards.list_id', 'lists.id')
      .where('cards.id', resourceId)
      .where('lists.board_id', boardId)
      .select('cards.id')
      .first();
    if (!card) throw new ResourceBoardMismatchError(scope, resourceId, boardId);
    return;
  }

  // member scope: no board relationship to enforce
}
