// GET /api/v1/boards/:id/background — secure proxy for S3-hosted board background images.
// Board visibility middleware has already run before this handler is called, so auth/access
// control is already enforced. This endpoint generates a fresh short-lived presigned URL
// and 302-redirects the browser so the token is never persisted in the response body.
import { db } from '../../../common/db';
import { presignGetUrl } from '../../attachment/common/presign';
import { extractS3KeyFromBackgroundUrl } from '../common/resolveBackgroundUrl';

const PROXY_TTL_SECONDS = 60;

export async function handleGetBackground(req: Request, boardId: string): Promise<Response> {
  const board = await db('boards').where({ id: boardId }).select('background').first();

  if (!board?.background) {
    return Response.json({ name: 'background-not-found' }, { status: 404 });
  }

  const s3Key = extractS3KeyFromBackgroundUrl(board.background);
  if (!s3Key) {
    // Non-S3 background (e.g. external URL) — redirect directly; no presigning needed.
    return Response.redirect(board.background, 302);
  }

  const { url } = await presignGetUrl({ s3Key, ttlSeconds: PROXY_TTL_SECONDS });
  return Response.redirect(url, 302);
}
