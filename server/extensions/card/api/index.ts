// Card API router — mounts all card routes.
import { handleCreateCard } from './create';
import { handleListCards } from './list';
import { handleGetCard } from './get';
import { handleUpdateCard } from './update';
import { handleArchiveCard } from './archive';
import { handleMoveCard } from './move';
import { handleDuplicateCard } from './duplicate';
import { handleDeleteCard } from './delete';
import { handleAttachLabel, handleDetachLabel } from './labels';
import { handleAssignMember, handleRemoveMember } from './members';
import { handleCreateChecklistItem, handleUpdateChecklistItem, handleDeleteChecklistItem } from './checklist';
import { handleListDueCards } from './dueDate';

// Returns a Response if the path matches a card route, otherwise null.
export async function cardRouter(req: Request, pathname: string): Promise<Response | null> {
  // List-scoped card creation/listing: /api/v1/lists/:listId/cards
  const listCardsMatch = pathname.match(/^\/api\/v1\/lists\/([^/]+)\/cards$/);
  if (listCardsMatch) {
    const listId = listCardsMatch[1] as string;
    if (req.method === 'POST') return handleCreateCard(req, listId);
    if (req.method === 'GET') return handleListCards(req, listId);
  }

  // Due date query: /api/v1/workspaces/:id/cards/due
  const dueDateMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/cards\/due$/);
  if (dueDateMatch && req.method === 'GET') {
    return handleListDueCards(req, dueDateMatch[1] as string);
  }

  // Checklist item routes: /api/v1/checklist-items/:id
  const checklistItemMatch = pathname.match(/^\/api\/v1\/checklist-items\/([^/]+)$/);
  if (checklistItemMatch) {
    const itemId = checklistItemMatch[1] as string;
    if (req.method === 'PATCH') return handleUpdateChecklistItem(req, itemId);
    if (req.method === 'DELETE') return handleDeleteChecklistItem(req, itemId);
  }

  // Card-scoped routes: /api/v1/cards/:id[/...]
  const cardMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)(\/.*)?$/);
  if (cardMatch) {
    const cardId = cardMatch[1] as string;
    const sub = cardMatch[2] ?? '';

    // GET /api/v1/cards/:id
    if (sub === '' && req.method === 'GET') return handleGetCard(req, cardId);

    // PATCH /api/v1/cards/:id
    if (sub === '' && req.method === 'PATCH') return handleUpdateCard(req, cardId);

    // DELETE /api/v1/cards/:id
    if (sub === '' && req.method === 'DELETE') return handleDeleteCard(req, cardId);

    // PATCH /api/v1/cards/:id/archive
    if (sub === '/archive' && req.method === 'PATCH') return handleArchiveCard(req, cardId);

    // PATCH /api/v1/cards/:id/move
    if (sub === '/move' && req.method === 'PATCH') return handleMoveCard(req, cardId);

    // POST /api/v1/cards/:id/duplicate
    if (sub === '/duplicate' && req.method === 'POST') return handleDuplicateCard(req, cardId);

    // POST /api/v1/cards/:id/labels — attach label
    if (sub === '/labels' && req.method === 'POST') return handleAttachLabel(req, cardId);

    // DELETE /api/v1/cards/:id/labels/:labelId — detach label
    const detachLabelMatch = sub.match(/^\/labels\/([^/]+)$/);
    if (detachLabelMatch && req.method === 'DELETE') {
      return handleDetachLabel(req, cardId, detachLabelMatch[1] as string);
    }

    // POST /api/v1/cards/:id/members — assign member
    if (sub === '/members' && req.method === 'POST') return handleAssignMember(req, cardId);

    // DELETE /api/v1/cards/:id/members/:userId — remove member
    const removeMemberMatch = sub.match(/^\/members\/([^/]+)$/);
    if (removeMemberMatch && req.method === 'DELETE') {
      return handleRemoveMember(req, cardId, removeMemberMatch[1] as string);
    }

    // POST /api/v1/cards/:id/checklist — add checklist item
    if (sub === '/checklist' && req.method === 'POST') return handleCreateChecklistItem(req, cardId);
  }

  return null;
}
