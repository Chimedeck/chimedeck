// POST /api/v1/plugins/data/batch — reads multiple plugin-scoped key/value entries
// in a single request. Accepts an array of items, each with the same shape as
// individual DATA_GET query params, and returns results keyed by subId.
//
// Auth: Authorization: Bearer <plugin-token>  (short-lived JWT issued by /token endpoint)
// Body: { items: Array<{ subId, scope, key, visibility, resourceId, boardId, userId? }> }
//
// WHY: on boards with many cards, each card's capability handler issues 4+ DATA_GET
// calls. Without batching, that's 4N HTTP requests. This endpoint collapses all
// requests across all cards into ONE database round-trip per 1-second window.
import { db } from '../../../../common/db';
import { resolvePluginToken } from '../../common/resolvePluginToken';
import {
  validateResourceBelongsToBoard,
  ResourceBoardMismatchError,
} from '../../common/validateResourceBelongsToBoard';

const VALID_SCOPES = ['card', 'list', 'board', 'member'] as const;
const VALID_VISIBILITY = ['private', 'shared'] as const;

type Scope = (typeof VALID_SCOPES)[number];
type Visibility = (typeof VALID_VISIBILITY)[number];

interface BatchItem {
  subId: string;
  scope: Scope;
  key: string;
  visibility: Visibility;
  resourceId: string;
  boardId: string;
  userId?: string;
}

interface BatchResult {
  subId: string;
  value: unknown;
  error?: string;
}

interface ValidatedItem {
  item: BatchItem;
  canonicalResourceId: string;
}

// ─── Validation helpers ────────────────────────────────────────────────

// Check whether an incoming boardId matches the token's board scope.
// Accepts both the short_id (claims.boardId) and the long UUID (claims.boardCanonicalId)
// because client URLs use short_ids while tokens may encode either format.
function boardIdMatchesClaims(
  incoming: string,
  claimsBoardId: string,
  claimsCanonicalId: string | undefined,
): boolean {
  return incoming === claimsBoardId || (claimsCanonicalId !== undefined && incoming === claimsCanonicalId);
}

function validateBatchItems(
  items: BatchItem[],
  boardId: string,
  boardCanonicalId: string | undefined,
): Response | null {
  for (const item of items) {
    if (item.boardId && !boardIdMatchesClaims(item.boardId, boardId, boardCanonicalId)) {
      return Response.json(
        { error: { code: 'forbidden', message: `boardId in item ${item.subId} does not match token scope` } },
        { status: 403 },
      );
    }
    if (!VALID_SCOPES.includes(item.scope)) {
      return Response.json(
        { error: { code: 'invalid-param', message: `scope in item ${item.subId} must be one of: card, list, board, member` } },
        { status: 400 },
      );
    }
    if (!item.resourceId) {
      return Response.json(
        { error: { code: 'missing-param', message: `resourceId is required in item ${item.subId}` } },
        { status: 400 },
      );
    }
    if (!item.key) {
      return Response.json(
        { error: { code: 'missing-param', message: `key is required in item ${item.subId}` } },
        { status: 400 },
      );
    }
    if (!VALID_VISIBILITY.includes(item.visibility)) {
      return Response.json(
        { error: { code: 'invalid-param', message: `visibility in item ${item.subId} must be private or shared` } },
        { status: 400 },
      );
    }
    if (item.visibility === 'private' && !item.userId) {
      return Response.json(
        { error: { code: 'missing-param', message: `userId is required for private visibility in item ${item.subId}` } },
        { status: 400 },
      );
    }
  }
  return null;
}

// ─── Canonical ID resolution ────────────────────────────────────────────

async function resolveCanonicalIds(
  items: BatchItem[],
  boardId: string,
): Promise<Array<{ subId: string; canonicalResourceId: string; error?: string }>> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const canonicalResourceId = await validateResourceBelongsToBoard(
          item.scope,
          item.resourceId,
          boardId,
        );
        return { subId: item.subId, canonicalResourceId };
      } catch (err) {
        if (err instanceof ResourceBoardMismatchError) {
          return {
            subId: item.subId,
            canonicalResourceId: item.resourceId,
            error: 'resource-board-mismatch',
          };
        }
        throw err;
      }
    }),
  );
}

// ─── DB query builder ────────────────────────────────────────────────────

function buildBatchQuery(
  pluginId: string,
  boardId: string,
  validItems: ValidatedItem[],
): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const { item, canonicalResourceId } of validItems) {
    if (item.visibility === 'private') {
      clauses.push(
        '(plugin_id = ? AND scope = ? AND resource_id = ? AND board_id = ? AND key = ? AND user_id = ?)',
      );
      params.push(pluginId, item.scope, canonicalResourceId, boardId, item.key, item.userId ?? null);
    } else {
      clauses.push(
        '(plugin_id = ? AND scope = ? AND resource_id = ? AND board_id = ? AND key = ? AND user_id IS NULL)',
      );
      params.push(pluginId, item.scope, canonicalResourceId, boardId, item.key);
    }
  }

  return { clauses, params };
}

// ─── Result mapping ─────────────────────────────────────────────────────

function mapRowsToResults(
  rows: Array<{
    scope: string;
    resource_id: string;
    key: string;
    user_id: string | null;
    value: unknown;
  }>,
  validItems: ValidatedItem[],
): BatchResult[] {
  const subIdByCompositeKey = new Map<string, string>();
  for (const { item, canonicalResourceId } of validItems) {
    const userIdPart = item.visibility === 'private' ? (item.userId ?? '') : '__shared__';
    const compositeKey = `${item.scope}|${canonicalResourceId}|${item.key}|${userIdPart}`;
    subIdByCompositeKey.set(compositeKey, item.subId);
  }

  const subIdToValue = new Map<string, unknown>();
  for (const row of rows) {
    const userIdPart = row.user_id ?? '__shared__';
    const compositeKey = `${row.scope}|${row.resource_id}|${row.key}|${userIdPart}`;
    const subId = subIdByCompositeKey.get(compositeKey);
    if (subId) {
      subIdToValue.set(subId, row.value);
    }
  }

  return validItems.map(({ item }) => ({
    subId: item.subId,
    value: subIdToValue.get(item.subId) ?? null,
  }));
}

// ─── Main handler ───────────────────────────────────────────────────────

export async function handleBatchGetPluginData(req: Request): Promise<Response> {
  const result = await resolvePluginToken(req);
  if (result instanceof Response) return result;
  const { plugin, claims } = result;
  // Use the canonical long UUID for all DB operations; fall back to boardId for old tokens
  // that predate the boardCanonicalId claim.
  const boardId = claims.boardCanonicalId ?? claims.boardId;

  let body: { items?: BatchItem[] };
  try {
    body = (await req.json()) as { items?: BatchItem[] };
  } catch {
    return Response.json(
      { error: { code: 'invalid-json', message: 'Request body must be valid JSON' } },
      { status: 400 },
    );
  }

  const items = body.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return Response.json(
      { error: { code: 'missing-param', message: 'items array is required and must not be empty' } },
      { status: 400 },
    );
  }

  // Validate all items upfront
  const validationError = validateBatchItems(items, claims.boardId, claims.boardCanonicalId);
  if (validationError) return validationError;

  // Resolve canonical resource IDs and validate board membership
  const canonicalResults = await resolveCanonicalIds(items, boardId);

  // Separate valid items from those with validation errors
  const validItems: ValidatedItem[] = [];
  const results: BatchResult[] = [];

  for (const cr of canonicalResults) {
    if (cr.error) {
      results.push({ subId: cr.subId, value: null, error: cr.error });
    } else {
      const item = items.find((i) => i.subId === cr.subId);
      if (item) {
        validItems.push({ item, canonicalResourceId: cr.canonicalResourceId });
      }
    }
  }

  if (validItems.length === 0) {
    return Response.json({ data: results });
  }

  // Build and execute a single batched query
  const pluginId = plugin.id as string;
  const { clauses, params } = buildBatchQuery(pluginId, boardId, validItems);
  const rows = (await db('plugin_data')
    .whereRaw(`(${clauses.join(' OR ')})`, params)
    .select('scope', 'resource_id', 'key', 'user_id', 'value')) as Array<{
    scope: string;
    resource_id: string;
    key: string;
    user_id: string | null;
    value: unknown;
  }>;

  // Map DB rows back to subIds and merge with existing error results
  const dbResults = mapRowsToResults(rows, validItems);
  results.push(...dbResults);

  return Response.json({ data: results });
}
