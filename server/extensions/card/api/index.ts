// Card API router — mounts all card routes.
import { handleCreateCard } from './create';
import { handleListCards } from './list';
import { handleGetCard } from './get';
import { handleUpdateCard } from './update';
import { handleArchiveCard } from './archive';
import { handleMoveCard } from './move';
import { handleDuplicateCard } from './duplicate';
import { handleDeleteCard } from './delete';

// Returns a Response if the path matches a card route, otherwise null.
export async function cardRouter(req: Request, pathname: string): Promise<Response | null> {
  // List-scoped card creation/listing: /api/v1/lists/:listId/cards
  const listCardsMatch = pathname.match(/^\/api\/v1\/lists\/([^/]+)\/cards$/);
  if (listCardsMatch) {
    const listId = listCardsMatch[1] as string;
    if (req.method === 'POST') return handleCreateCard(req, listId);
    if (req.method === 'GET') return handleListCards(req, listId);
  }

  // Card-scoped routes: /api/v1/cards/:id[/archive|/move|/duplicate]
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

    // POST /api/v1/cards/:id/move
    if (sub === '/move' && req.method === 'POST') return handleMoveCard(req, cardId);

    // POST /api/v1/cards/:id/duplicate
    if (sub === '/duplicate' && req.method === 'POST') return handleDuplicateCard(req, cardId);
  }

  return null;
}
