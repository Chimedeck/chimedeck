// POST /api/v1/boards/:boardId/health-checks
// Adds a new health check entry to the board.
// Auth: board member. Validates URL scheme and rejects SSRF targets and duplicates.
import { randomUUID } from 'crypto';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { applyBoardVisibility } from '../../../middlewares/boardVisibility';
import { validateUrl, UrlValidationError } from '../common/validateUrl';

const MAX_NAME_LENGTH = 120;

export async function handleCreateHealthCheck(
  req: Request,
  boardId: string,
): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const visibilityError = await applyBoardVisibility(req, boardId);
  if (visibilityError) return visibilityError;

  let body: {
    name?: string;
    url?: string;
    type?: string;
    presetKey?: string;
    expectedStatus?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json(
      { name: 'bad-request', data: { message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  // Validate required fields.
  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'name is required' } },
      { status: 400 },
    );
  }

  if (body.name.trim().length > MAX_NAME_LENGTH) {
    return Response.json(
      { name: 'bad-request', data: { message: `name must not exceed ${MAX_NAME_LENGTH} characters` } },
      { status: 400 },
    );
  }

  if (!body.url || typeof body.url !== 'string' || body.url.trim() === '') {
    return Response.json(
      { name: 'bad-request', data: { message: 'url is required' } },
      { status: 400 },
    );
  }

  // Validate URL — scheme allow-list + SSRF prevention.
  let parsedUrl: URL;
  try {
    parsedUrl = validateUrl(body.url.trim());
  } catch (err) {
    if (err instanceof UrlValidationError) {
      return Response.json(
        { name: err.name, data: { message: err.message } },
        { status: 422 },
      );
    }
    throw err;
  }

  const type = body.type === 'preset' ? 'preset' : 'custom';

  if (type === 'preset' && !body.presetKey) {
    return Response.json(
      { name: 'bad-request', data: { message: 'presetKey is required when type is preset' } },
      { status: 400 },
    );
  }

  // Validate optional expectedStatus — must be an integer in the valid HTTP status range.
  let expectedStatus: number | null = null;
  if (body.expectedStatus !== undefined && body.expectedStatus !== null) {
    const code = Number(body.expectedStatus);
    if (!Number.isInteger(code) || code < 100 || code > 599) {
      return Response.json(
        { name: 'bad-request', data: { message: 'expectedStatus must be an integer between 100 and 599' } },
        { status: 400 },
      );
    }
    expectedStatus = code;
  }

  // Duplicate URL check — case-insensitive per board.
  const duplicate = await db('board_health_checks')
    .where({ board_id: boardId })
    .whereRaw('LOWER(url) = LOWER(?)', [parsedUrl.toString()])
    .first();

  if (duplicate) {
    return Response.json(
      { name: 'health-check-url-already-monitored', data: { message: 'This URL is already being monitored on this board' } },
      { status: 409 },
    );
  }

  const id = randomUUID();
  const createdBy = (req as AuthenticatedRequest).currentUser!.id;

  await db('board_health_checks').insert({
    id,
    board_id: boardId,
    name: body.name.trim(),
    url: parsedUrl.toString(),
    type,
    preset_key: type === 'preset' ? (body.presetKey ?? null) : null,
    expected_status: expectedStatus,
    is_active: true,
    created_by: createdBy,
  });

  const created = await db('board_health_checks').where({ id }).first();

  return Response.json(
    {
      data: {
        id: created.id,
        boardId: created.board_id,
        name: created.name,
        url: created.url,
        type: created.type,
        presetKey: created.preset_key ?? null,
        expectedStatus: created.expected_status ?? null,
        isActive: created.is_active,
        createdAt: created.created_at,
        latestResult: null,
      },
    },
    { status: 201 },
  );
}
