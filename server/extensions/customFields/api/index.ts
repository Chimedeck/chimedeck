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
} from './cardValues';

export async function customFieldsRouter(req: Request, pathname: string): Promise<Response | null> {
  // /api/v1/boards/:boardId/custom-fields[/:fieldId]
  const boardFieldsMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/custom-fields(\/([^/]+))?$/);
  if (boardFieldsMatch) {
    const boardId = boardFieldsMatch[1] as string;
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
