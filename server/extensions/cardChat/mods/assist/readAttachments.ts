// readAttachments — tool definition and handler for reading card attachments
// in the card-chat assist loop. Adapted from the board-chat version but
// scoped to a single card (the cardId is always the current card).
// Sprint 208: Same rules as board-chat — if >3 attachments, read 3 latest
// and prompt the AI to ask the user which specific files they want.
import { db } from '../../../../common/db';
import { resolveCardId } from '../../../../common/ids/resolveEntityId';
import { s3Client, s3Config } from '../../../attachment/common/config/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type {
  CardChatAssistContentPart,
  CardChatAssistOutput,
  CardChatAssistToolCall,
  CardChatAssistToolDefinition,
} from '../../types';

export const READ_ATTACHMENTS_TOOL: CardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'read_attachments',
    description:
      'Read specific file attachments from the current card. Use this when the user asks to read particular files from the card. The card_id is optional — if omitted, the current card is used automatically. Provide file_names to read specific files, or omit to get the 3 latest readable files.',
    parameters: {
      type: 'object',
      properties: {
        card_id: {
          type: 'string',
          description:
            'Optional. The card ID to read attachments from. Defaults to the current card being discussed. Only provide this if the user explicitly asks about a different card.',
        },
        file_names: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional. Specific file names to read. If omitted, the 3 latest readable files are fetched. Names should match the attachment display names.',
        },
      },
      additionalProperties: false,
    },
  },
};

interface ReadAttachmentsArguments {
  card_id?: string;
  file_names?: string[];
}

interface ReadAttachmentsInput {
  cardId: string;
  toolCall: CardChatAssistToolCall;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeReadAttachmentsArguments(
  rawArguments: string
): ReadAttachmentsArguments | CardChatAssistOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'read_attachments arguments must be valid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'read_attachments arguments must be an object',
    };
  }

  const candidate = parsed as Record<string, unknown>;

  // [why] card_id is optional — the server auto-injects the current card ID.
  // Only validate if the AI explicitly provided one.
  if (candidate.card_id !== undefined) {
    if (typeof candidate.card_id !== 'string' || candidate.card_id.trim() === '') {
      return {
        status: 422,
        name: 'invalid-tool-payload',
        message: 'read_attachments.card_id must be a non-empty string if provided',
      };
    }
  }

  const fileNames = candidate.file_names;
  if (fileNames !== undefined) {
    if (!Array.isArray(fileNames)) {
      return {
        status: 422,
        name: 'invalid-tool-payload',
        message: 'read_attachments.file_names must be an array of strings',
      };
    }
    for (const name of fileNames) {
      if (typeof name !== 'string' || name.trim() === '') {
        return {
          status: 422,
          name: 'invalid-tool-payload',
          message: 'read_attachments.file_names must contain only non-empty strings',
        };
      }
    }
  }

  return {
    ...(candidate.card_id === undefined ? {} : { card_id: (candidate.card_id as string).trim() }),
    ...(fileNames ? { file_names: (fileNames as string[]).map((n: string) => n.trim()) } : {}),
  };
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

const PDF_MIME_TYPE = 'application/pdf';
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_ATTACHMENT_BYTES = 100 * 1024;
// [why] When no specific file_names are given, only read the 3 latest
// readable files — same rule as board-chat to avoid context blowup.
// The AI should then ask the user if they want more files read.
const MAX_DEFAULT_FILES = 3;

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
  created_at: string;
}

function isReadable(mimeType: string): boolean {
  return (
    TEXT_MIME_TYPES.has(mimeType) || IMAGE_MIME_TYPES.has(mimeType) || mimeType === PDF_MIME_TYPE
  );
}

async function fetchAttachments(cardId: string): Promise<AttachmentRow[]> {
  return (await db('attachments')
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

async function readS3Object(s3Key: string): Promise<Uint8Array | null> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: s3Config.bucket, Key: s3Key })
    );
    if (!result.Body) return null;
    return await result.Body.transformToByteArray();
  } catch {
    return null;
  }
}

function toDataUri(bytes: Uint8Array, mimeType: string): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

async function processAttachment(
  att: AttachmentRow
): Promise<{ part: CardChatAssistContentPart | null; name: string; skipped: string | null }> {
  const displayName = att.alias ?? att.name;
  const mimeType = att.content_type ?? att.mime_type ?? 'application/octet-stream';
  const size = att.size_bytes ?? 0;

  if (size > MAX_ATTACHMENT_BYTES) {
    return { part: null, name: displayName, skipped: `too large: ${String(size)} bytes` };
  }
  if (!att.s3_key) {
    return { part: null, name: displayName, skipped: 'no S3 key' };
  }

  const bytes = await readS3Object(att.s3_key);
  if (!bytes) {
    return { part: null, name: displayName, skipped: 'failed to read from S3' };
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      part: { type: 'image_url', image_url: { url: toDataUri(bytes, mimeType), detail: 'auto' } },
      name: displayName,
      skipped: null,
    };
  }

  // [why] PDFs are binary and not valid image_url formats — the OpenAI-compatible
  // API only accepts image/png, image/jpeg, image/gif, image/webp for image_url parts.
  // Sending application/pdf as image_url causes "invalid image input" errors.
  if (mimeType === PDF_MIME_TYPE) {
    return { part: null, name: displayName, skipped: 'PDFs are not supported for AI reading' };
  }

  if (TEXT_MIME_TYPES.has(mimeType)) {
    if (size > MAX_TEXT_ATTACHMENT_BYTES) {
      return { part: null, name: displayName, skipped: `text too large: ${String(size)} bytes` };
    }
    const text = new TextDecoder().decode(bytes);
    return {
      part: { type: 'text', text: `[Attachment: ${displayName}]\n${text}` },
      name: displayName,
      skipped: null,
    };
  }

  return { part: null, name: displayName, skipped: `unsupported type: ${mimeType}` };
}

// [why] Select which attachments to process based on user's file_names or
// default to the 3 latest readable files. Extracted to keep readAttachments
// below the cognitive complexity limit.
function selectAttachments(
  allAttachments: AttachmentRow[],
  fileNames: string[] | undefined
): AttachmentRow[] {
  if (fileNames && fileNames.length > 0) {
    const nameSet = new Set(fileNames.map((n) => n.toLowerCase()));
    return allAttachments.filter((att) => {
      const displayName = (att.alias ?? att.name).toLowerCase();
      return nameSet.has(displayName) || nameSet.has(att.name.toLowerCase());
    });
  }
  // [why] No specific names — fetch 3 latest readable files, newest first.
  // The AI should then ask the user if they want more files read.
  return allAttachments
    .filter((att) => isReadable(att.content_type ?? att.mime_type ?? 'application/octet-stream'))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_DEFAULT_FILES);
}

// [why] Process attachments and build the result message + content parts.
// Extracted to keep readAttachments below the cognitive complexity limit.
async function processAndBuildResult(
  selectedAttachments: AttachmentRow[],
  allAttachments: AttachmentRow[],
  cardId: string
): Promise<{
  contentParts: CardChatAssistContentPart[];
  message: string;
}> {
  const contentParts: CardChatAssistContentPart[] = [];
  const readNames: string[] = [];
  const skippedNotes: string[] = [];

  for (const att of selectedAttachments) {
    const { part, name, skipped } = await processAttachment(att);
    if (part) {
      contentParts.push(part);
      readNames.push(name);
    }
    if (skipped) {
      skippedNotes.push(`${name} (${skipped})`);
    }
  }

  const messageLines: string[] = [
    `Read ${String(readNames.length)} attachment(s) from card "${cardId}":`,
    ...readNames.map((n) => `  - ${n}`),
  ];
  if (skippedNotes.length > 0) {
    messageLines.push(`Skipped ${String(skippedNotes.length)} file(s):`);
    for (const note of skippedNotes) {
      messageLines.push(`  - ${note}`);
    }
  }

  // [why] If there are more unread attachments beyond the 3-default cap,
  // tell the AI to ask the user which specific files they want next.
  const unreadCount = allAttachments.filter(
    (att) => isReadable(att.content_type ?? att.mime_type ?? 'application/octet-stream')
  ).length - selectedAttachments.length;
  if (unreadCount > 0) {
    const unreadNames = allAttachments
      .filter((att) => isReadable(att.content_type ?? att.mime_type ?? 'application/octet-stream'))
      .filter((att) => !selectedAttachments.some((s) => s.id === att.id))
      .map((att) => att.alias ?? att.name);
    messageLines.push(
      '',
      `⚠️ This card has ${String(unreadCount)} more attachment(s) not yet read:`,
      ...unreadNames.map((n) => `  - ${n}`),
      'Ask the user which specific files they want to read next (by name), or whether they want all remaining files. When the user responds, call read_attachments with the card_id and the file_names they chose.'
    );
  }

  return { contentParts, message: messageLines.join('\n') };
}

export async function readAttachments(input: ReadAttachmentsInput): Promise<CardChatAssistOutput> {
  const normalized = normalizeReadAttachmentsArguments(input.toolCall.function.arguments);
  if ('status' in normalized) return normalized;

  // [why] Use the server-provided cardId as fallback when the AI doesn't
  // pass card_id — since we're in a card-chat context, the current card
  // is always the right target.
  const targetCardId = normalized.card_id ?? input.cardId;

  // [why] Resolve short ID → full UUID so the DB query works with either format.
  const resolvedId = await resolveCardId(targetCardId);
  if (!resolvedId) {
    return {
      status: 404,
      name: 'card-not-found',
      message: `No card found with ID "${targetCardId}".`,
    };
  }

  const allAttachments = await fetchAttachments(resolvedId);
  if (allAttachments.length === 0) {
    return {
      status: 200,
      data: {
        model: input.model,
        message: `Card "${targetCardId}" has no file attachments.`,
        ...(input.usage ? { usage: input.usage } : {}),
        toolCalls: [input.toolCall],
      },
    };
  }

  const selectedAttachments = selectAttachments(allAttachments, normalized.file_names);
  if (selectedAttachments.length === 0) {
    const allNames = allAttachments.map((att) => att.alias ?? att.name).join(', ');
    return {
      status: 200,
      data: {
        model: input.model,
        message:
          `None of the requested file names matched attachments on card "${targetCardId}". ` +
          `Available files: ${allNames}`,
        ...(input.usage ? { usage: input.usage } : {}),
        toolCalls: [input.toolCall],
      },
    };
  }

  const { contentParts, message } = await processAndBuildResult(
    selectedAttachments,
    allAttachments,
    targetCardId
  );

  return {
    status: 200,
    data: {
      model: input.model,
      message,
      ...(contentParts.length > 0 ? { contentParts } : {}),
      ...(input.usage ? { usage: input.usage } : {}),
      toolCalls: [input.toolCall],
    },
  };
}
