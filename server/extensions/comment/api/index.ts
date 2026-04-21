// Comment API router.
import { handleCreateComment } from './create';
import { handleListComments } from './list';
import { handleUpdateComment } from './update';
import { handleDeleteComment } from './delete';
import { reactionsRouter } from './reactions/index';
import { repliesRouter } from './replies/index';
import { resolveCommentId } from '../../../common/ids/resolveEntityId';

async function resolveCommentIdOrNotFound(identifier: string): Promise<string | Response> {
  const commentId = await resolveCommentId(identifier);
  if (!commentId) {
    return Response.json(
      { error: { code: 'comment-not-found', message: 'Comment not found' } },
      { status: 404 },
    );
  }
  return commentId;
}

async function routeCardComments(req: Request, pathname: string): Promise<Response | null> {
  const cardCommentsMatch = pathname.match(/^\/api\/v1\/cards\/([^/]+)\/comments$/);
  if (!cardCommentsMatch) return null;
  if (req.method === 'GET') return handleListComments(req, cardCommentsMatch[1] as string);
  if (req.method === 'POST') return handleCreateComment(req, cardCommentsMatch[1] as string);
  return null;
}

async function routeCommentMutations(req: Request, pathname: string): Promise<Response | null> {
  const commentMatch = pathname.match(/^\/api\/v1\/comments\/([^/]+)$/);
  if (!commentMatch) return null;

  const resolved = await resolveCommentIdOrNotFound(commentMatch[1] as string);
  if (resolved instanceof Response) return resolved;
  if (req.method === 'PATCH') return handleUpdateComment(req, resolved);
  if (req.method === 'DELETE') return handleDeleteComment(req, resolved);
  return null;
}

async function routeCommentNested(req: Request, pathname: string): Promise<Response | null> {
  const reactionsRe = /^\/api\/v1\/comments\/([^/]+)\/reactions(\/.*)?$/;
  const reactionsMatch = reactionsRe.exec(pathname);
  if (reactionsMatch) {
    const resolved = await resolveCommentIdOrNotFound(reactionsMatch[1] as string);
    if (resolved instanceof Response) return resolved;
    const remaining = reactionsMatch[2] ?? '';
    return reactionsRouter(req, resolved, remaining);
  }

  const repliesRe = /^\/api\/v1\/comments\/([^/]+)\/replies$/;
  const repliesMatch = repliesRe.exec(pathname);
  if (!repliesMatch) return null;

  const resolved = await resolveCommentIdOrNotFound(repliesMatch[1] as string);
  if (resolved instanceof Response) return resolved;
  return repliesRouter(req, resolved);
}

export async function commentRouter(req: Request, pathname: string): Promise<Response | null> {
  const cardCommentsResponse = await routeCardComments(req, pathname);
  if (cardCommentsResponse) return cardCommentsResponse;

  const commentMutationsResponse = await routeCommentMutations(req, pathname);
  if (commentMutationsResponse) return commentMutationsResponse;

  const nestedResponse = await routeCommentNested(req, pathname);
  if (nestedResponse) return nestedResponse;

  return null;
}
