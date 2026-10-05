import type { StateTransitionForbiddenError } from '../stateTransitions/common/errors';

export function toTrelloStateTransitionForbiddenResponse(
  error: StateTransitionForbiddenError
): Response {
  return Response.json(
    {
      message: `State transition from "${error.fromListName}" to "${error.toListName}" is not allowed.`,
      error: 'STATE_TRANSITION_FORBIDDEN',
    },
    { status: 422 }
  );
}
