// GET /api/v1/cards/:cardId/chat/messages
// Sprint 171 — cursor-paginated retrieval of card-scoped chat messages.
import { authenticate, type AuthenticatedRequest } from '../../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../../middlewares/permissionManager';
import { getCardChatMessages } from '../../mods/messages/query';
import { buildAvatarProxyUrl } from '../../../../common/avatar/resolveAvatarUrl';

export const cardChatApiDeps = {
  authenticate,
  requireWorkspaceMembership,
  getCardChatMessages,
};

export async function handleGetCardChatMessages(req: Request, cardId: string): Promise<Response> {
  const authError = await cardChatApiDeps.authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor') ?? null;
  const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);

  const result = await cardChatApiDeps.getCardChatMessages({
    cardId,
    cursor,
    limit: limitParam,
  });

  // Resolve avatars for messages with author_id
  const dataWithAvatars = result.data.map((msg) => ({
    ...msg,
    avatar: msg.author_id
      ? buildAvatarProxyUrl({ userId: msg.author_id, avatarUrl: msg.avatar ?? null })
      : null,
  }));

  return Response.json({
    data: dataWithAvatars,
    metadata: result.metadata,
  });
}
