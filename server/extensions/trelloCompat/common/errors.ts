export function trelloError(message: string, status: number): Response {
  const error =
    status === 401 || status === 403
      ? 'UNAUTHORIZED'
      : 'ERROR';

  return Response.json({ message, error }, { status });
}

export const TRELLO_NOT_FOUND = () => trelloError('The requested resource was not found.', 404);
export const TRELLO_UNAUTHORIZED = () => trelloError('invalid token', 401);
export const TRELLO_PERMISSION_DENIED = () => trelloError('unauthorized permission requested', 401);
export const TRELLO_CARD_NOT_FOUND = () => trelloError('The requested card was not found.', 404);
export const TRELLO_LIST_NOT_FOUND = () => trelloError('The requested list was not found.', 404);
export const TRELLO_COMMENT_NOT_FOUND = () => trelloError('The requested action was not found.', 404);
export const TRELLO_CHECKLIST_NOT_FOUND = () => trelloError('The requested checklist was not found.', 404);
export const TRELLO_LABEL_NOT_FOUND = () => trelloError('The requested label was not found.', 404);
export const TRELLO_MEMBER_NOT_FOUND = () => trelloError('The requested member was not found.', 404);
export const TRELLO_ORGANIZATION_NOT_FOUND = () => trelloError('The requested organization was not found.', 404);
export const TRELLO_ACTION_NOT_FOUND = () => trelloError('The requested action was not found.', 404);
export const TRELLO_ACTION_TEXT_UNSUPPORTED = () =>
  trelloError('Action does not have an associated action text.', 422);
export const TRELLO_CUSTOM_FIELD_NOT_FOUND = () =>
  trelloError('The requested custom field was not found.', 404);
export const TRELLO_CUSTOM_FIELD_OPTION_NOT_FOUND = () =>
  trelloError('The requested custom field option was not found.', 404);
