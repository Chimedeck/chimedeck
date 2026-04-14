// server/extensions/search/api/getBoardSearch.ts
// GET /api/v1/boards/:boardId/search
// Board-scoped search: returns only cards and lists from the requested board.
// RBAC: caller must have board read access (enforced via applyBoardVisibility).
import { applyBoardVisibility, type BoardVisibilityScopedRequest } from '../../../middlewares/boardVisibility';
import { queryBoardSearch } from '../mods/queryBoardSearch';
import { searchLog } from '../common/searchLogger';

export async function handleBoardSearch(req: Request, boardId: string): Promise<Response> {
  // Verify board exists and caller has access (handles auth, workspace membership, visibility)
  const accessError = await applyBoardVisibility(req, boardId);
  if (accessError) {
    const scopedForLog = req as Partial<BoardVisibilityScopedRequest>;
    searchLog.boardSearchAccessDenied({
      boardId,
      userId: (scopedForLog.currentUser as { id?: string } | undefined)?.id,
      statusCode: accessError.status,
    });
    return accessError;
  }

  const scopedReq = req as BoardVisibilityScopedRequest;
  const userId = (scopedReq.currentUser as { id?: string } | undefined)?.id;

  searchLog.boardSearchRequest({ boardId, userId });

  const url = new URL(req.url);
  const q = url.searchParams.get('query') ?? url.searchParams.get('q') ?? '';
  const limitParam = url.searchParams.get('limit');

  const opts: { boardId: string; q: string; limit?: number } = { boardId, q };
  if (limitParam) opts.limit = Number.parseInt(limitParam, 10);

  const result = await queryBoardSearch(opts);

  if (result.status !== 200) {
    return Response.json(
      { error: { code: result.name, message: result.message } },
      { status: result.status },
    );
  }

  searchLog.boardSearchResults({
    boardId,
    userId,
    resultCount: result.data?.length ?? 0,
  });

  return Response.json({ data: result.data });
}
