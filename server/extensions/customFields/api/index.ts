// server/extensions/customFields/api/index.ts
// Router for all custom field endpoints:
//   - Board-scoped field definitions: /api/v1/boards/:id/custom-fields[/:fieldId]
//   - Card-scoped field values:        /api/v1/cards/:id/custom-field-values/:fieldId
import {
  handleListCustomFields,
  handleCreateCustomField,
  handleUpdateCustomField,
  handleDeleteCustomField,
} from './fieldDefinitions';
import {
  handleListCardFieldValues,
  handleGetCardFieldValue,
  handleUpsertCardFieldValue,
  handleDeleteCardFieldValue,
  handleBatchCardFieldValues,
} from './cardValues';
import { resolveBoardId } from '../../../common/ids/resolveEntityId';

export async function customFieldsRouter(req: Request, pathname: string): Promise<Response | null> {
  // /api/v1/boards/:boardId/custom-fields[/:fieldId]
  const boardFieldsMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/custom-fields(\/([^/]+))?$/);
  if (boardFieldsMatch) {
    const boardIdentifier = boardFieldsMatch[1] as string;
    const boardId = await resolveBoardId(boardIdentifier);
    if (!boardId) {
      return Response.json(
        { error: { code: 'board-not-found', message: 'Board not found' } },
        { status: 404 },
      );
    }
    const fieldId = boardFieldsMatch[3] as string | undefined;

    if (!fieldId) {
      if (req.method === 'GET') return handleListCustomFields(req, boardId);
      if (req.method === 'POST') return handleCreateCustomField(req, boardId);
    }

    if (fieldId) {
      if (req.method === 'PATCH') return handleUpdateCustomField(req, boardId, fieldId);
      if (req.method === 'DELETE') return handleDeleteCustomField(req, boardId, fieldId);
    }
  }

  // GET/POST /api/v1/boards/:boardId/custom-field-values  (batch)
  //   - GET:  ?cardIds=id1,id2,... (legacy)
  //   - POST: { cardIds: [id1, id2, ...] } (preferred; avoids overly long URLs)
  // [why] Must be checked before the board custom-fields pattern since the path differs
  //       (custom-field-values vs custom-fields) — placed here for clarity.
  const boardBatchValuesMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/custom-field-values$/);
  if (boardBatchValuesMatch && (req.method === 'GET' || req.method === 'POST')) {
    const boardIdentifier = boardBatchValuesMatch[1] as string;
    const boardId = await resolveBoardId(boardIdentifier);
    if (!boardId) {
      return Response.json(
        { error: { code: 'board-not-found', message: 'Board not found' } },
        { status: 404 },
      );
    }
    return handleBatchCardFieldValues(req, boardId);
  }

  // /api/v1/cards/:cardId/custom-field-values (list all)
  const cardAllValuesMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/custom-field-values$/);
  if (cardAllValuesMatch) {
    const cardId = cardAllValuesMatch[1] as string;
    if (req.method === 'GET') return handleListCardFieldValues(req, cardId);
  }

  // /api/v1/cards/:cardId/custom-field-values/:fieldId
  const cardValuesMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/custom-field-values\/([^/]+)$/);
  if (cardValuesMatch) {
    const cardId = cardValuesMatch[1] as string;
    const fieldId = cardValuesMatch[2] as string;

    if (req.method === 'GET') return handleGetCardFieldValue(req, cardId, fieldId);
    if (req.method === 'PUT') return handleUpsertCardFieldValue(req, cardId, fieldId);
    if (req.method === 'DELETE') return handleDeleteCardFieldValue(req, cardId, fieldId);
  }

  return null;
}
