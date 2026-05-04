// PATCH /api/v1/attachments/:id
// Updates attachment alias and/or URL (for URL-type attachments).
// Requires authentication and board membership.
// Validates alias: non-empty string, max 255 characters.
// Validates URL updates and re-resolves referenced_card_id for internal links.
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { isForbiddenUrl, parseInternalCardUrl } from './addUrl';
import { resolveCardId } from '../../../common/ids/resolveEntityId';

const MAX_ALIAS_LENGTH = 255;

function patchError({ name, message, status }: { name: string; message: string; status: number }): Response {
  return Response.json({ name, data: { message } }, { status });
}

function parsePatchBody(reqBody: unknown): {
  aliasProvided: boolean;
  urlProvided: boolean;
  alias: unknown;
  url: unknown;
} {
  const rawPatch = reqBody as Record<string, unknown>;
  return {
    aliasProvided: Object.hasOwn(rawPatch, 'alias'),
    urlProvided: Object.hasOwn(rawPatch, 'url'),
    alias: rawPatch.alias,
    url: rawPatch.url,
  };
}

function validateAlias(alias: unknown): string | Response {
  if (typeof alias !== 'string' || alias.trim() === '') {
    return patchError({
      name: 'alias-required',
      message: 'alias must be a non-empty string',
      status: 400,
    });
  }

  if (alias.length > MAX_ALIAS_LENGTH) {
    return patchError({
      name: 'alias-too-long',
      message: `alias must be at most ${MAX_ALIAS_LENGTH} characters`,
      status: 400,
    });
  }

  return alias.trim();
}

function validateUrl(url: unknown): string | Response {
  if (typeof url !== 'string' || url.trim() === '') {
    return patchError({
      name: 'url-required',
      message: 'url must be a non-empty string',
      status: 400,
    });
  }

  const nextUrl = url.trim();
  try {
    new URL(nextUrl);
  } catch {
    return patchError({
      name: 'url-invalid',
      message: 'url must be a valid absolute URL',
      status: 400,
    });
  }

  return nextUrl;
}

async function resolveReferencedCardIdForUrl({
  nextUrl,
  reqUrl,
  workspaceId,
}: {
  nextUrl: string;
  reqUrl: string;
  workspaceId: string;
}): Promise<string | null | Response> {
  if (!parseInternalCardUrl(nextUrl, reqUrl) && isForbiddenUrl(nextUrl)) {
    return patchError({
      name: 'url-target-forbidden',
      message: 'URL resolves to a forbidden internal address',
      status: 400,
    });
  }

  const internalCard = parseInternalCardUrl(nextUrl, reqUrl);
  if (!internalCard) return null;

  const resolvedReferencedCardId = await resolveCardId(internalCard.cardId);
  const referencedCard = resolvedReferencedCardId
    ? await db('cards').where({ id: resolvedReferencedCardId }).first()
    : null;

  if (!referencedCard) {
    return patchError({
      name: 'referenced-card-not-found',
      message: 'The linked card was not found',
      status: 404,
    });
  }

  const refList = await db('lists').where({ id: referencedCard.list_id }).first();
  const refBoard = refList ? await db('boards').where({ id: refList.board_id }).first() : null;
  if (refBoard?.workspace_id !== workspaceId) {
    return patchError({
      name: 'referenced-card-not-in-workspace',
      message: 'The linked card is not in the same workspace',
      status: 400,
    });
  }

  return referencedCard.id as string;
}

async function loadPatchContext({
  req,
  attachmentId,
}: {
  req: Request;
  attachmentId: string;
}): Promise<
  | {
      attachment: Record<string, unknown>;
      board: Record<string, unknown>;
    }
  | Response
> {
  const attachment = await db('attachments').where({ id: attachmentId }).first();
  if (!attachment) {
    return patchError({ name: 'attachment-not-found', message: 'Attachment not found', status: 404 });
  }

  const card = await db('cards').where({ id: attachment.card_id }).first();
  const list = card ? await db('lists').where({ id: card.list_id }).first() : null;
  const board = list ? await db('boards').where({ id: list.board_id }).first() : null;
  if (!board) {
    return patchError({ name: 'board-not-found', message: 'Board not found', status: 404 });
  }

  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  return { attachment, board };
}

async function buildPatchUpdates({
  req,
  patchBody,
  attachment,
  board,
}: {
  req: Request;
  patchBody: unknown;
  attachment: Record<string, unknown>;
  board: Record<string, unknown>;
}): Promise<Record<string, unknown> | Response> {
  const { aliasProvided, urlProvided, alias, url } = parsePatchBody(patchBody);

  if (!aliasProvided && !urlProvided) {
    return patchError({
      name: 'invalid-attachment-patch',
      message: 'Provide at least one of alias or url',
      status: 400,
    });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (aliasProvided) {
    const validatedAlias = validateAlias(alias);
    if (validatedAlias instanceof Response) return validatedAlias;
    updates.alias = validatedAlias;
  }

  if (urlProvided) {
    if (attachment.type !== 'URL') {
      return patchError({
        name: 'url-update-not-allowed',
        message: 'Only URL attachments can update url',
        status: 400,
      });
    }

    const nextUrl = validateUrl(url);
    if (nextUrl instanceof Response) return nextUrl;

    const referencedCardId = await resolveReferencedCardIdForUrl({
      nextUrl,
      reqUrl: req.url,
      workspaceId: board.workspace_id as string,
    });
    if (referencedCardId instanceof Response) return referencedCardId;

    updates.url = nextUrl;
    updates.referenced_card_id = referencedCardId;
  }

  return updates;
}

export async function handlePatchAttachment(req: Request, attachmentId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const context = await loadPatchContext({ req, attachmentId });
  if (context instanceof Response) return context;

  const { attachment, board } = context;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return patchError({ name: 'invalid-request-body', message: 'Request body must be valid JSON', status: 400 });
  }

  const updates = await buildPatchUpdates({ req, patchBody: body, attachment, board });
  if (updates instanceof Response) return updates;

  const [updated] = await db('attachments')
    .where({ id: attachmentId })
    .update(updates)
    .returning('*');

  const view_url =
    updated.type === 'URL'
      ? (updated.url ?? updated.external_url ?? null)
      : `/api/v1/attachments/${updated.id}/view`;

  const thumbnail_url = updated.thumbnail_key
    ? `/api/v1/attachments/${updated.id}/thumbnail`
    : null;

  return Response.json({
    data: {
      id: updated.id,
      card_id: updated.card_id,
      name: updated.name,
      alias: updated.alias ?? null,
      type: updated.type,
      content_type: updated.mime_type ?? null,
      size_bytes: updated.size_bytes ?? null,
      status: updated.status,
      view_url,
      thumbnail_url,
      external_url: updated.external_url ?? null,
      referenced_card_id: updated.referenced_card_id ?? null,
      referenced_card: null,
      width: updated.width ?? null,
      height: updated.height ?? null,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  });
}
