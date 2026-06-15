// Validates that a given resourceId (card or list) belongs to the specified boardId.
// Throws a structured error for mismatches; no-ops for board/member scopes.
import { db } from '../../../common/db';
import { resolveBoardId, resolveCardId, resolveListId } from '../../../common/ids/resolveEntityId';

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
): Promise<string> {
  if (scope === 'board') {
    const resolvedBoardId = await resolveBoardId(resourceId);
    if (!resolvedBoardId || resolvedBoardId !== boardId) {
      throw new ResourceBoardMismatchError(scope, resourceId, boardId);
    }
    return resolvedBoardId;
  }

  if (scope === 'list') {
    const resolvedListId = await resolveListId(resourceId);
    if (!resolvedListId) throw new ResourceBoardMismatchError(scope, resourceId, boardId);

    const list = await db('lists').where({ id: resolvedListId, board_id: boardId }).first();
    if (!list) throw new ResourceBoardMismatchError(scope, resourceId, boardId);
    return resolvedListId;
  }

  if (scope === 'card') {
    const resolvedCardId = await resolveCardId(resourceId);
    if (!resolvedCardId) throw new ResourceBoardMismatchError(scope, resourceId, boardId);

    // cards don't have a direct board_id — join through lists
    const card = await db('cards')
      .join('lists', 'cards.list_id', 'lists.id')
      .where('cards.id', resolvedCardId)
      .where('lists.board_id', boardId)
      .select('cards.id')
      .first();
    if (!card) throw new ResourceBoardMismatchError(scope, resourceId, boardId);
    return resolvedCardId;
  }

  // member scope: no board relationship to enforce
  return resourceId;
}
