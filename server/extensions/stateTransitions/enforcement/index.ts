import { featureFlags } from '../../../config/featureFlags';
import { emitCardMoveBlockedActivity } from '../common/activityLog';
import { StateTransitionForbiddenError } from '../common/errors';
import { getRulesForBoard } from './rules';

type ValidateCardMoveInput = {
  boardId: string;
  fromListId: string;
  toListId: string;
  cardId?: string;
  actorId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function validateCardMove({
  boardId,
  fromListId,
  toListId,
  cardId,
  actorId,
  ipAddress,
  userAgent,
}: ValidateCardMoveInput): Promise<void> {
  if (fromListId === toListId) return;
  if (!featureFlags.STATE_TRANSITIONS_ENABLED) return;

  const boardRules = await getRulesForBoard(boardId);
  if (!boardRules.hasStateTransitionRow || !boardRules.enabled) return;
  if (!boardRules.listNameById.has(fromListId)) return;

  const rawAllowedNextStates = boardRules.allowedNextStatesByListId.get(fromListId) ?? [];
  const allowedNextStates = rawAllowedNextStates.filter((state, index, arr) =>
    arr.findIndex((candidate) => candidate.id === state.id) === index,
  );
  const isAllowed = allowedNextStates.some((nextState) => nextState.id === toListId);
  if (isAllowed) return;

  const fromListName = boardRules.listNameById.get(fromListId) ?? fromListId;
  const toListName = boardRules.listNameById.get(toListId) ?? toListId;
  if (cardId && actorId) {
    await emitCardMoveBlockedActivity({
      cardId,
      boardId,
      actorId,
      fromListId,
      fromListName,
      toListId,
      toListName,
      ipAddress,
      userAgent,
    });
  }

  throw new StateTransitionForbiddenError({
    boardId,
    fromListId,
    fromListName,
    toListId,
    toListName,
    allowedNextStates,
  });
}
