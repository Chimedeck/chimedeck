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
  // [why] Needed to sort attachments by recency so we pick the 3 latest
  // readable files when a card has more than 3 attachments.
  created_at: string;
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
      'url',
      'created_at'
    )) as AttachmentRow[];
}

// [why] Fetch attachment names for multiple cards in one query. Returns a
// map of card_id → array of attachment display names (alias or name). Used by
// keyword search to list specific file names so the AI can ask the user which
// files they want to read.
async function fetchAttachmentNames(cardIds: string[]): Promise<Record<string, string[]>> {
  if (cardIds.length === 0) return {};
  const rows = (await searchCardsDeps
    .db('attachments')
    .whereIn('card_id', cardIds)
    .where('status', 'READY')
    .where('type', 'FILE')
    .whereNotNull('s3_key')
    .select('card_id', 'name', 'alias')) as Array<{
    card_id: string;
    name: string;
    alias: string | null;
  }>;
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    const displayName = row.alias ?? row.name;
    const arr = (result[row.card_id] ??= []);
    arr.push(displayName);
  }
  return result;
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

// [why] Determine if an attachment can be processed (read as text, sent as
// image, or rendered as PDF). Used to identify "readable" files for the
// 3-file default cap and to sort readable files ahead of unreadable ones.
function isReadableAttachment(att: AttachmentRow): boolean {
  const mimeType = att.content_type ?? att.mime_type ?? 'application/octet-stream';
  return (
    TEXT_MIME_TYPES.has(mimeType) || IMAGE_MIME_TYPES.has(mimeType) || mimeType === PDF_MIME_TYPE
  );
}

// [why] Determine why an attachment was skipped by processOneAttachment.
// Extracted to keep buildAttachmentContentParts below cognitive complexity limit.
function skippedReason(att: AttachmentRow, mimeType: string, size: number): string {
  if (size > MAX_ATTACHMENT_BYTES) {
    return `too large: ${String(size)} bytes`;
  }
  if (!att.s3_key) {
    return 'no S3 key';
  }
  if (size > MAX_TEXT_ATTACHMENT_BYTES && TEXT_MIME_TYPES.has(mimeType)) {
    return `text too large: ${String(size)} bytes`;
  }
  return `unsupported type: ${mimeType}`;
}

// [why] Process a single attachment: read from S3, convert to content part.
// Returns the content part or null if the attachment was skipped.
async function processOneAttachment(
  att: AttachmentRow,
  displayName: string,
  mimeType: string,
  size: number
): Promise<BoardChatAssistContentPart | null> {
  if (size > MAX_ATTACHMENT_BYTES) return null;
  if (!att.s3_key) return null;

  const bytes = await readS3Object(att.s3_key);
  if (!bytes) return null;

  if (IMAGE_MIME_TYPES.has(mimeType) || mimeType === PDF_MIME_TYPE) {
    const dataUri = toDataUri(bytes, mimeType);
    return {
      type: 'image_url',
      image_url: { url: dataUri, detail: 'auto' },
    };
  }

  if (TEXT_MIME_TYPES.has(mimeType)) {
    if (size > MAX_TEXT_ATTACHMENT_BYTES) return null;
    const text = new TextDecoder().decode(bytes);
    return {
      type: 'text',
      text: `[Attachment: ${displayName}]\n${text}`,
    };
  }

  return null;
}

// [why] Build content parts for card attachments. Images and PDFs become
// image_url parts (base64 data URIs). Text files become text parts.
// Other file types are skipped with a note in the message.
// maxParts caps how many attachments to process (default: no cap).
// Returns allNames for the caller to list when some files were skipped.
async function buildAttachmentContentParts(
  attachments: AttachmentRow[],
  maxParts?: number
): Promise<{
  contentParts: BoardChatAssistContentPart[];
  skippedNames: string[];
  allNames: string[];
}> {
  const contentParts: BoardChatAssistContentPart[] = [];
  const skippedNames: string[] = [];
  const allNames: string[] = [];
  const limit = typeof maxParts === 'number' ? maxParts : Infinity;
  let processed = 0;

  for (const att of attachments) {
    const displayName = att.alias ?? att.name;
    allNames.push(displayName);
    const mimeType = att.content_type ?? att.mime_type ?? 'application/octet-stream';
    const size = att.size_bytes ?? 0;

    if (processed >= limit) {
      skippedNames.push(`${displayName} (skipped: limit of ${String(limit)} files reached)`);
      continue;
    }

    const part = await processOneAttachment(att, displayName, mimeType, size);
    if (part) {
      contentParts.push(part);
      processed++;
    } else {
      skippedNames.push(`${displayName} (${skippedReason(att, mimeType, size)})`);
    }
  }

  return { contentParts, skippedNames, allNames };
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
  // When there are more than 3 attachments, only process the 3 latest
  // readable files by default and list all names so the AI can ask the
  // user which specific files they want to include.
  let contentParts: BoardChatAssistContentPart[] | undefined;
  let attachmentNote = '';
  if (attachments.length > 0) {
    // [why] Sort: readable files first, then by recency (newest first).
    // This ensures the 3-file cap picks the most useful and recent files.
    const sorted = [...attachments].sort((a, b) => {
      const aReadable = isReadableAttachment(a);
      const bReadable = isReadableAttachment(b);
      if (aReadable && !bReadable) return -1;
      if (!aReadable && bReadable) return 1;
      // Both readable or both unreadable — sort by recency, newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const maxParts = attachments.length > 3 ? 3 : undefined;
    const {
      contentParts: parts,
      skippedNames,
      allNames,
    } = await buildAttachmentContentParts(sorted, maxParts);
    if (parts.length > 0) contentParts = parts;

    const namesList = allNames.join(', ');
    attachmentNote = '\n  - Attachments (' + String(allNames.length) + ' files): ' + namesList;
    if (skippedNames.length > 0) {
      attachmentNote += '\n    (skipped: ' + skippedNames.join(', ') + ')';
    }

    // [why] When there are more than 3 attachments, prompt the AI to ask
    // the user which files they want to read. The AI should list all file
    // names and let the user choose specific files or all files before
    // calling read_attachments with the card ID and chosen file names.
    if (attachments.length > 3) {
      attachmentNote +=
        '\n  - ⚠️ This card has more than 3 attachments. Only the 3 latest readable files were processed. ' +
        'Ask the user which specific files they want to read (by name), or whether they want all files. ' +
        'When the user responds, call read_attachments with the card_id and the file_names they chose.';
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

  // [why] Fetch attachment names for all matching cards in one query so the
  // AI can list specific file names and ask the user which ones they want to
  // read. This is a lightweight query — no S3 fetching.
  const attachmentNames =
    cards.length > 0 ? await fetchAttachmentNames(cards.map((c) => c.id)) : {};

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
            const names = attachmentNames[c.id];
            if (names && names.length > 0) {
              parts.push(`  - Attachments (${String(names.length)} files): ${names.join(', ')}`);
            }
            return parts.join('\n');
          })
          .join('\n')
      : 'No matching cards found on this board.';

  // [why] When any card in the results has attachments, add a note prompting
  // the AI to ask the user which specific files they want to read. The AI
  // should list the file names and let the user choose before calling
  // read_attachments with the card ID and chosen file names.
  const cardsWithAttachments = cards.filter((c) => (attachmentNames[c.id]?.length ?? 0) > 0);
  const attachmentPrompt =
    cardsWithAttachments.length > 0
      ? '\n\nSome of these cards have file attachments. Ask the user which ' +
        'specific files they want to read (by name), or whether they want all files. ' +
        'When the user responds, call read_attachments with the card_id and the file_names they chose. ' +
        'Here are the cards with attachments and their file names:\n' +
        cardsWithAttachments
          .map((c) => {
            const names = attachmentNames[c.id] ?? [];
            return `  - "${c.title}": ${names.join(', ')}`;
          })
          .join('\n')
      : '';

  return {
    status: 200,
    data: {
      model: input.model,
      message: `Card search results for "${normalized.query}":\n${resultsText}${attachmentPrompt}`,
      ...(input.usage ? { usage: input.usage } : {}),
      toolCalls: [input.toolCall],
    },
  };
}
