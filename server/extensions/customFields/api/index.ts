// server/extensions/customFields/api/index.ts
// Router for all custom field endpoints under /api/v1/boards/:id/custom-fields.
import {
  handleListCustomFields,
  handleCreateCustomField,
  handleUpdateCustomField,
  handleDeleteCustomField,
} from './fieldDefinitions';

export async function customFieldsRouter(req: Request, pathname: string): Promise<Response | null> {
  // /api/v1/boards/:boardId/custom-fields[/:fieldId]
  const boardFieldsMatch = pathname.match(/^\/api\/v1\/boards\/([^/]+)\/custom-fields(\/([^/]+))?$/);
  if (!boardFieldsMatch) return null;

  const boardId = boardFieldsMatch[1] as string;
  const fieldId = boardFieldsMatch[3] as string | undefined;

  // Collection routes: no fieldId
  if (!fieldId) {
    if (req.method === 'GET') return handleListCustomFields(req, boardId);
    if (req.method === 'POST') return handleCreateCustomField(req, boardId);
  }

  // Item routes: fieldId present
  if (fieldId) {
    if (req.method === 'PATCH') return handleUpdateCustomField(req, boardId, fieldId);
    if (req.method === 'DELETE') return handleDeleteCustomField(req, boardId, fieldId);
  }

  return null;
}
