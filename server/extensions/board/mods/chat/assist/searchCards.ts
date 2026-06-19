import { queryBoardSearch } from '../../../../search/mods/queryBoardSearch';
import { resolveCardId } from '../../../../../common/ids/resolveEntityId';
import { db } from '../../../../../common/db';
import { s3Client, s3Config } from '../../../../attachment/common/config/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type {
  BoardChatAssistContentPart,
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
  BoardChatAssistToolDefinition,
} from '../../../types';

export const SEARCH_CARDS_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'search_cards',
    description:
      'Search for cards on the current board by keyword or card ID. Returns matching cards with title, description, IDs (long UUID and short ID), list ID, due date, start date, created/updated timestamps, and archived status. Supports lookup by short ID (e.g. "ukvedwsc") or full UUID. Use this to help the user find relevant cards before creating new ones or to answer questions about existing work.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search keywords (minimum 2 characters) or a card ID (short ID or full UUID). Matches against card titles and descriptions for keywords, or resolves directly by ID.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

interface SearchCardsArguments {
  query: string;
}

interface SearchCardsInput {
  boardId: string;
  toolCall: BoardChatAssistToolCall;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeSearchArguments(
  rawArguments: string
): SearchCardsArguments | BoardChatAssistOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'search_cards arguments must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'search_cards arguments must be an object',
    };
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.query !== 'string' || candidate.query.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'search_cards.query must be a non-empty string',
    };
  }

  return {
    query: candidate.query.trim(),
  };
}

export const searchCardsDeps = {
  queryBoardSearch,
  resolveCardId,
  db,
};

// [why] Short IDs are 8-char alphanumeric strings. UUIDs are 36-char with dashes.
// Detect when the query looks like a card identifier rather than a keyword search.
function looksLikeCardId(query: string): boolean {
  // UUID pattern: 8-4-4-4-12 hex digits with dashes
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Short ID pattern: exactly 8 alphanumeric characters (matching SHORT_ID_ALPHABET)
  const shortIdPattern = /^[A-Za-z0-9]{8}$/;
  return uuidPattern.test(query) || shortIdPattern.test(query);
}

// [why] When the user provides a card ID (short or long), resolve it directly
// and verify it belongs to the current board. This avoids the full-text search
// path which can't match IDs against card titles/descriptions.
interface CardByIdResult {
  message: string;
  contentParts?: BoardChatAssistContentPart[] | undefined;
}

interface CardByIdRow {
  id: string;
  short_id: string;
  title: string;
  description: string | null;
  list_id: string;
  due_date: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

interface ChecklistRow {
  id: string;
  title: string;
}

interface ChecklistItemRow {
  id: string;
  checklist_id: string;
  title: string;
  checked: boolean;
}

interface CustomFieldValueRow {
  custom_field_id: string;
  field_name: string;
  field_type: string;
  value_text: string | null;
  value_number: string | null;
  value_date: string | null;
  value_checkbox: boolean | null;
  value_option_id: string | null;
  options: unknown; // JSONB dropdown options
}

interface LabelRow {
  id: string;
  name: string;
  color: string;
}

interface AttachmentRow {
  id: string;
  name: string;
  alias: string | null;
  mime_type: string | null;
  content_type: string | null;
  s3_key: string | null;
  size_bytes: number | null;
  type: 'FILE' | 'URL';
  url: string | null;
}

// [why] MIME types that can be read as text and included inline for the AI.
const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/x-markdown',
  'text/html',
  'text/xml',
  'application/json',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
  'application/xml',
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'text/x-python',
  'text/x-ruby',
  'text/x-go',
  'text/x-java',
  'text/x-c',
  'text/x-shellscript',
]);

// [why] Image MIME types that can be sent as base64 data URIs to vision models.
const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

// [why] PDFs can be sent as base64 to vision-capable models (Ollama supports this).
const PDF_MIME_TYPE = 'application/pdf';

// [why] Maximum attachment size to fetch from S3 (5 MB). Larger files are
// skipped to avoid memory pressure and context window blowup.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// [why] Maximum text file size to include inline (100 KB). Larger text files
// would blow up the context window.
const MAX_TEXT_ATTACHMENT_BYTES = 100 * 1024;

// [why] Fetch READY file attachments for a card. URL-type attachments are
// listed but their content is not fetched (the AI can't browse URLs).
async function fetchCardAttachments(cardId: string): Promise<AttachmentRow[]> {
  return (await searchCardsDeps
    .db('attachments')
    .where('card_id', cardId)
    .where('status', 'READY')
    .where('type', 'FILE')
    .whereNotNull('s3_key')
    .select(
      'id',
      'name',
      'alias',
      'mime_type',
      'content_type',
      's3_key',
      'size_bytes',
      'type',
      'url'
    )) as AttachmentRow[];
}

// [why] Read an S3 object and return its body as a Uint8Array.
async function readS3Object(s3Key: string): Promise<Uint8Array | null> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: s3Key,
      })
    );
    if (!result.Body) return null;
    // [why] transformToByteArray is the simplest way to get the full body
    // for small files. For larger files we'd need streaming, but we cap at 5MB.
    return await result.Body.transformToByteArray();
  } catch {
    return null;
  }
}

// [why] Convert a Uint8Array to a base64 data URI with the given MIME type.
function toDataUri(bytes: Uint8Array, mimeType: string): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

// [why] Build content parts for card attachments. Images and PDFs become
// image_url parts (base64 data URIs). Text files become text parts.
// Other file types are skipped with a note in the message.
async function buildAttachmentContentParts(
  attachments: AttachmentRow[]
): Promise<{ contentParts: BoardChatAssistContentPart[]; skippedNames: string[] }> {
  const contentParts: BoardChatAssistContentPart[] = [];
  const skippedNames: string[] = [];

  for (const att of attachments) {
    const displayName = att.alias ?? att.name;
    const mimeType = att.content_type ?? att.mime_type ?? 'application/octet-stream';
    const size = att.size_bytes ?? 0;

    if (size > MAX_ATTACHMENT_BYTES) {
      skippedNames.push(`${displayName} (too large: ${String(size)} bytes)`);
      continue;
    }

    if (!att.s3_key) {
      skippedNames.push(`${displayName} (no S3 key)`);
      continue;
    }

    const bytes = await readS3Object(att.s3_key);
    if (!bytes) {
      skippedNames.push(`${displayName} (failed to read from storage)`);
      continue;
    }

    if (IMAGE_MIME_TYPES.has(mimeType) || mimeType === PDF_MIME_TYPE) {
      // [why] PDFs are sent as image_url parts — Ollama vision models render
      // the first page. OpenAI-compatible APIs may handle PDFs differently
      // but the base64 data URI format is universally accepted.
      const dataUri = toDataUri(bytes, mimeType);
      contentParts.push({
        type: 'image_url',
        image_url: { url: dataUri, detail: 'auto' },
      });
    } else if (TEXT_MIME_TYPES.has(mimeType)) {
      if (size > MAX_TEXT_ATTACHMENT_BYTES) {
        skippedNames.push(`${displayName} (text too large: ${String(size)} bytes)`);
        continue;
      }
      const text = new TextDecoder().decode(bytes);
      contentParts.push({
        type: 'text',
        text: `[Attachment: ${displayName}]\n${text}`,
      });
    } else {
      skippedNames.push(`${displayName} (unsupported type: ${mimeType})`);
    }
  }

  return { contentParts, skippedNames };
}

// [why] Fetch checklists and their items for a card. Returns grouped data
// so the AI can see task breakdown and completion status.
async function fetchCardChecklists(
  cardId: string
): Promise<Array<{ checklist: ChecklistRow; items: ChecklistItemRow[] }>> {
  const checklists = (await searchCardsDeps
    .db('checklists')
    .where('card_id', cardId)
    .orderBy('position', 'asc')
    .select('id', 'title')) as ChecklistRow[];

  if (checklists.length === 0) return [];

  const checklistIds = checklists.map((cl) => cl.id);
  const items = (await searchCardsDeps
    .db('checklist_items')
    .whereIn('checklist_id', checklistIds)
    .orderBy('position', 'asc')
    .select('id', 'checklist_id', 'title', 'checked')) as ChecklistItemRow[];

  // [why] Explicitly type the grouped result so template literals don't get `any` errors.
  const result: Array<{ checklist: ChecklistRow; items: ChecklistItemRow[] }> = checklists.map(
    (checklist) => ({
      checklist,
      items: items.filter((item) => item.checklist_id === checklist.id),
    })
  );
  return result;
}

// [why] Fetch custom field values for a card, joined with field definitions
// so the AI sees both the field name/type and the card's value.
async function fetchCardCustomFields(cardId: string): Promise<CustomFieldValueRow[]> {
  return (await searchCardsDeps
    .db('card_custom_field_values as v')
    .join('custom_fields as f', 'v.custom_field_id', 'f.id')
    .where('v.card_id', cardId)
    .select(
      'v.custom_field_id',
      'f.name as field_name',
      'f.field_type',
      'v.value_text',
      'v.value_number',
      'v.value_date',
      'v.value_checkbox',
      'v.value_option_id',
      'f.options'
    )) as CustomFieldValueRow[];
}

// [why] Fetch labels assigned to a card. Labels carry semantic meaning
// (e.g. "bug", "feature", "urgent") that the AI should know about.
async function fetchCardLabels(cardId: string): Promise<LabelRow[]> {
  return (await searchCardsDeps
    .db('card_labels as cl')
    .join('labels as l', 'cl.label_id', 'l.id')
    .where('cl.card_id', cardId)
    .select('l.id', 'l.name', 'l.color')) as LabelRow[];
}

// [why] Format a custom field value into a human-readable string based on its type.
function formatCustomFieldValue(row: CustomFieldValueRow): string {
  switch (row.field_type) {
    case 'TEXT':
      return row.value_text ?? '(empty)';
    case 'NUMBER':
      return row.value_number ?? '(empty)';
    case 'DATE':
      return row.value_date ?? '(empty)';
    case 'CHECKBOX':
      return row.value_checkbox ? '☑ checked' : '☐ unchecked';
    case 'DROPDOWN': {
      if (!row.value_option_id) return '(none selected)';
      const options = row.options as Array<{ id: string; label: string }> | null;
      const selected = options?.find((o) => o.id === row.value_option_id);
      return selected ? selected.label : row.value_option_id;
    }
    default:
      return '(unknown type)';
  }
}

// [why] Build the core card field lines (title, IDs, description, dates, timestamps).
function formatCardCoreFields(card: CardByIdRow): string[] {
  const statusNote = card.archived ? ' (archived)' : '';
  const descSuffix =
    card.description && card.description.length > 2000
      ? card.description.slice(0, 2000) + '… (truncated)'
      : card.description;
  return [
    `- **"${card.title}"**${statusNote}`,
    `  - Card ID: \`${card.id}\``,
    `  - Short ID: \`${card.short_id}\``,
    `  - List ID: \`${card.list_id}\``,
    ...(descSuffix ? [`  - Description: ${descSuffix}`] : []),
    ...(card.due_date ? [`  - Due date: ${card.due_date}`] : []),
    ...(card.start_date ? [`  - Start date: ${card.start_date}`] : []),
    `  - Created: ${card.created_at}`,
    `  - Updated: ${card.updated_at}`,
  ];
}

// [why] Format labels into a single comma-separated line.
function formatLabelsLine(labels: LabelRow[]): string | null {
  if (labels.length === 0) return null;
  const parts = labels.map((l) => l.name + ' (' + l.color + ')');
  return '  - Labels: ' + parts.join(', ');
}

// [why] Format custom field values into indented lines.
function formatCustomFieldLines(customFields: CustomFieldValueRow[]): string[] {
  if (customFields.length === 0) return [];
  const lines = ['  - Custom Fields:'];
  for (const cf of customFields) {
    lines.push(`    - ${cf.field_name} (${cf.field_type}): ${formatCustomFieldValue(cf)}`);
  }
  return lines;
}

// [why] Format checklists with their items and completion counts.
function formatChecklistLines(
  checklistsWithItems: Array<{ checklist: ChecklistRow; items: ChecklistItemRow[] }>
): string[] {
  if (checklistsWithItems.length === 0) return [];
  const lines = ['  - Checklists:'];
  for (const { checklist, items } of checklistsWithItems) {
    const completed = items.filter((i) => i.checked).length;
    lines.push(`    - ${checklist.title} (${String(completed)}/${String(items.length)} done):`);
    for (const item of items) {
      lines.push(`      - ${item.checked ? '☑' : '☐'} ${item.title}`);
    }
  }
  return lines;
}

// [why] Compose all card detail sections into a single formatted message.
function formatCardDetail(
  card: CardByIdRow,
  labels: LabelRow[],
  customFields: CustomFieldValueRow[],
  checklistsWithItems: Array<{ checklist: ChecklistRow; items: ChecklistItemRow[] }>
): string {
  const labelsLine = formatLabelsLine(labels);
  const parts: string[] = [
    ...formatCardCoreFields(card),
    ...(labelsLine ? [labelsLine] : []),
    ...formatCustomFieldLines(customFields),
    ...formatChecklistLines(checklistsWithItems),
  ];
  return parts.join('\n');
}

async function lookupCardById(query: string, boardId: string): Promise<CardByIdResult | null> {
  const resolvedId = await searchCardsDeps.resolveCardId(query);
  if (!resolvedId) return null;

  const card = (await searchCardsDeps
    .db('cards')
    .join('lists', 'cards.list_id', 'lists.id')
    .where('cards.id', resolvedId)
    .where('lists.board_id', boardId)
    .select(
      'cards.id',
      'cards.short_id',
      'cards.title',
      'cards.description',
      'cards.list_id',
      'cards.due_date',
      'cards.start_date',
      'cards.created_at',
      'cards.updated_at',
      'cards.archived'
    )
    .first()) as CardByIdRow | undefined;

  if (!card) return null;

  const [checklistsWithItems, customFields, labels, attachments] = await Promise.all([
    fetchCardChecklists(resolvedId),
    fetchCardCustomFields(resolvedId),
    fetchCardLabels(resolvedId),
    fetchCardAttachments(resolvedId),
  ]);

  // [why] Build attachment content parts for vision-capable models.
  // This runs in parallel with the detail formatting.
  let contentParts: BoardChatAssistContentPart[] | undefined;
  let attachmentNote = '';
  if (attachments.length > 0) {
    const { contentParts: parts, skippedNames } = await buildAttachmentContentParts(attachments);
    if (parts.length > 0) contentParts = parts;
    const names = attachments.map((a) => a.alias ?? a.name);
    attachmentNote = '\n  - Attachments: ' + names.join(', ');
    if (skippedNames.length > 0) {
      attachmentNote += '\n    (skipped: ' + skippedNames.join(', ') + ')';
    }
  }

  const detail = formatCardDetail(card, labels, customFields, checklistsWithItems) + attachmentNote;
  return { message: `Found card by ID "${query}":\n${detail}`, contentParts };
}

export async function searchCards(input: SearchCardsInput): Promise<BoardChatAssistOutput> {
  const normalized = normalizeSearchArguments(input.toolCall.function.arguments);
  if ('status' in normalized) return normalized;

  // [why] Try direct ID lookup first — if the query looks like a card ID,
  // resolve it directly rather than relying on full-text search which can't
  // match IDs against card titles.
  if (looksLikeCardId(normalized.query)) {
    const idResult = await lookupCardById(normalized.query, input.boardId);
    if (idResult) {
      return {
        status: 200,
        data: {
          model: input.model,
          message: idResult.message,
          ...(idResult.contentParts ? { contentParts: idResult.contentParts } : {}),
          ...(input.usage ? { usage: input.usage } : {}),
          toolCalls: [input.toolCall],
        },
      };
    }
    // [why] If ID lookup didn't find a card on this board, fall through to
    // full-text search — the query might be a short ID from another board
    // that happens to match a card title on this board.
  }

  const searchResult = await searchCardsDeps.queryBoardSearch({
    boardId: input.boardId,
    q: normalized.query,
  });

  if (searchResult.status !== 200 || !searchResult.data) {
    return {
      status: searchResult.status,
      name: searchResult.name ?? 'search-cards-failed',
      message: searchResult.message ?? 'Card search failed',
    };
  }

  const cards = searchResult.data.filter((hit) => hit.type === 'card');
  const resultsText =
    cards.length > 0
      ? cards
          .map((c) => {
            const parts: string[] = [
              `- **"${c.title}"**${c.archived ? ' (archived)' : ''}`,
              `  - Card ID: \`${c.id}\`, Short ID: \`${c.short_id ?? 'N/A'}\`, List ID: \`${c.listId ?? 'unknown'}\``,
            ];
            if (c.description) {
              let desc: string;
              if (c.description.length > 500) {
                desc = c.description.slice(0, 500) + '…';
              } else {
                desc = c.description;
              }
              parts.push(`  - Description: ${desc}`);
            }
            if (c.due_date) parts.push(`  - Due: ${c.due_date}`);
            if (c.start_date) parts.push(`  - Start: ${c.start_date}`);
            return parts.join('\n');
          })
          .join('\n')
      : 'No matching cards found on this board.';

  return {
    status: 200,
    data: {
      model: input.model,
      message: `Card search results for "${normalized.query}":\n${resultsText}`,
      ...(input.usage ? { usage: input.usage } : {}),
      toolCalls: [input.toolCall],
    },
  };
}
