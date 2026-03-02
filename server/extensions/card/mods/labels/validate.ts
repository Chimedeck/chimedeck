// Validate max 20 labels per card — enforced before attaching a new label.
import { db } from '../../../../common/db';

export async function validateCardLabelLimit(cardId: string): Promise<Response | null> {
  const count = await db('card_labels').where({ card_id: cardId }).count('* as n').first();
  const n = Number((count as { n: number })?.n ?? 0);
  if (n >= 20) {
    return Response.json(
      { name: 'card-label-limit', data: { message: 'A card can have at most 20 labels' } },
      { status: 400 },
    );
  }
  return null;
}
