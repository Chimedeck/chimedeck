// Card API wrappers used by boardSlice and board components.
// Extends src/extensions/Card/api.ts — moveCard uses PATCH per the API spec.
export {
  listCards,
  createCard,
  getCard,
  updateCard,
  archiveCard,
  duplicateCard,
  deleteCard,
} from '../../Card/api';
export type { Card } from '../../Card/api';

// moveCard uses PATCH /api/v1/cards/:id/move (sprint-18 spec §5)
export async function moveCard({
  api,
  cardId,
  targetListId,
  afterCardId,
}: {
  api: { patch: <T>(url: string, data: unknown) => Promise<T> };
  cardId: string;
  targetListId: string;
  afterCardId?: string | null;
}): Promise<{ data: import('../../Card/api').Card }> {
  return api.patch<{ data: import('../../Card/api').Card }>(
    `/api/v1/cards/${cardId}/move`,
    { targetListId, afterCardId },
  );
}
