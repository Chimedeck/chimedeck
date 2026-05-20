export const ACTION_TYPES = [
  {
    id: 'allowed_move_to',
    labelKey: 'StateTransitions.action.allowedMoveTo',
    colour: '#22c55e',
    // TODO: Add icon/description/validation metadata as action types grow.
  },
] as const;

export type ActionTypeConfig = (typeof ACTION_TYPES)[number];
export type ActionTypeId = ActionTypeConfig['id'];

export const DEFAULT_ACTION_TYPE_ID: ActionTypeId = ACTION_TYPES[0].id;

export function getActionTypeConfig(actionTypeId: string): ActionTypeConfig {
  return ACTION_TYPES.find((actionType) => actionType.id === actionTypeId) ?? ACTION_TYPES[0];
}
