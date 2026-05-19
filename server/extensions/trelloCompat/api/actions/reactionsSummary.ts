import { serializeReactionsSummary } from '../../serializers/reaction';
import { listActionReactions } from './reactions';

export async function getActionReactionsSummary(commentId: string) {
  const reactions = await listActionReactions(commentId);
  return serializeReactionsSummary({ idModel: commentId, reactions });
}
