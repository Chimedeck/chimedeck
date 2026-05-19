import { flags } from '../../../mods/flags';
import type { AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { TRELLO_NOT_FOUND } from '../common/errors';
import { trelloAuth } from '../middlewares/trelloAuth';
import { actionsRouter } from './actions';
import { boardsRouter } from './boards';
import { cardsRouter } from './cards';
import { checklistsRouter } from './checklists';
import { customFieldsRouter } from './customFields';
import { labelsRouter } from './labels';
import { listsRouter } from './lists';
import { membersRouter } from './members';
import { organizationsRouter } from './organizations';
import { searchRouter } from './search';

const DISABLED_RESPONSE = Response.json(
  { message: 'Trello compatibility layer is not enabled on this server.', error: 'ERROR' },
  { status: 501 },
);

export async function trelloCompatRouter(req: Request, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith('/trello/1/')) return null;

  if (!(await flags.isTrelloCompatEnabled())) return DISABLED_RESPONSE;

  const authError = await trelloAuth(req);
  if (authError) return authError;

  const path = pathname.slice('/trello/1'.length);
  const authReq = req as AuthenticatedRequest;

  const boardsResponse = await boardsRouter(authReq, path);
  if (boardsResponse) return boardsResponse;

  const cardsResponse = await cardsRouter(authReq, path);
  if (cardsResponse) return cardsResponse;

  const listsResponse = await listsRouter(authReq, path);
  if (listsResponse) return listsResponse;

  return (
    (await checklistsRouter(authReq, path)) ??
    (await customFieldsRouter(authReq, path)) ??
    (await labelsRouter(authReq, path)) ??
    (await membersRouter(authReq, path)) ??
    (await organizationsRouter(authReq, path)) ??
    (await actionsRouter(authReq, path)) ??
    (await searchRouter(authReq, path)) ??
    TRELLO_NOT_FOUND()
  );
}
