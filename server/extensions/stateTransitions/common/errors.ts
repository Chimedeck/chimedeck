import type { StateTransitionAllowedNextState } from './types';

export type StateTransitionErrorName =
  | 'not-implemented'
  | 'bad-request'
  | 'board-not-found'
  | 'state-transition-load-failed'
  | 'state-transition-update-failed'
  | 'state-transition-graph-invalid'
  | 'state-transition-graph-out-of-sync'
  | 'state-transition-node-unknown-list'
  | 'state-transition-sync-failed'
  | 'state-transition-rules-invalid';

export type StateTransitionErrorResponse = {
  name: StateTransitionErrorName | string;
  data?: Record<string, unknown>;
};

export function stateTransitionError(
  name: StateTransitionErrorName | string,
  data?: Record<string, unknown>,
): StateTransitionErrorResponse {
  return data ? { name, data } : { name };
}

export function stateTransitionSyncError(
  data?: Record<string, unknown>,
): StateTransitionErrorResponse {
  return stateTransitionError('state-transition-sync-failed', data);
}

export function stateTransitionRulesError(
  data?: Record<string, unknown>,
): StateTransitionErrorResponse {
  return stateTransitionError('state-transition-rules-invalid', data);
}

type StateTransitionForbiddenErrorInput = {
  boardId: string;
  fromListId: string;
  fromListName: string;
  toListId: string;
  toListName: string;
  allowedNextStates: StateTransitionAllowedNextState[];
};

export class StateTransitionForbiddenError extends Error {
  readonly boardId: string;
  readonly fromListId: string;
  readonly fromListName: string;
  readonly toListId: string;
  readonly toListName: string;
  readonly allowedNextStates: StateTransitionAllowedNextState[];

  constructor({
    boardId,
    fromListId,
    fromListName,
    toListId,
    toListName,
    allowedNextStates,
  }: StateTransitionForbiddenErrorInput) {
    super(`State transition from "${fromListName}" to "${toListName}" is forbidden`);
    this.name = 'StateTransitionForbiddenError';
    Object.setPrototypeOf(this, StateTransitionForbiddenError.prototype);
    this.boardId = boardId;
    this.fromListId = fromListId;
    this.fromListName = fromListName;
    this.toListId = toListId;
    this.toListName = toListName;
    this.allowedNextStates = allowedNextStates.map((state) => ({ ...state }));
  }
}
