// readAttachments — tool definition and handler for reading specific card
// attachments. When a card has more than 3 attachments, the AI asks the user
// which files they want; this tool lets the AI fetch exactly those files.
import { db } from '../../../../../common/db';
import { resolveCardId } from '../../../../../common/ids/resolveEntityId';
import { s3Client, s3Config } from '../../../../attachment/common/config/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type {
  BoardChatAssistContentPart,
  BoardChatAssistOutput,
  BoardChatAssistToolCall,
  BoardChatAssistToolDefinition,
} from '../../../types';

export const READ_ATTACHMENTS_TOOL: BoardChatAssistToolDefinition = {
  type: 'function',
  function: {
    name: 'read_attachments',
    description:
      'Read specific file attachments from a card. Use this when the user asks to read particular files from a card that has attachments. Provide the card ID and optionally a list of file names to read. If file_names is omitted, all readable files on the card are fetched (up to 10).',
    parameters: {
      type: 'object',
      properties: {
        card_id: {
          type: 'string',
          description: 'The card ID (short ID or full UUID) whose attachments to read.',
        },
        file_names: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional. Specific file names to read. If omitted, all readable files are fetched. Names should match the attachment display names shown in search results.',
        },
      },
      required: ['card_id'],
      additionalProperties: false,
    },
  },
};

interface ReadAttachmentsArguments {
  card_id: string;
  file_names?: string[];
}

interface ReadAttachmentsInput {
  boardId: string;
  toolCall: BoardChatAssistToolCall;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function normalizeReadAttachmentsArguments(
  rawArguments: string
): ReadAttachmentsArguments | BoardChatAssistOutput {
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

  if (typeof candidate.card_id !== 'string' || candidate.card_id.trim() === '') {
    return {
      status: 422,
      name: 'invalid-tool-payload',
      message: 'read_attachments.card_id must be a non-empty string',
    };
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
    card_id: candidate.card_id.trim(),
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
// [why] Cap total files when no specific names are given — prevents context blowup.
const MAX_DEFAULT_FILES = 10;

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
): Promise<{ part: BoardChatAssistContentPart | null; name: string; skipped: string | null }> {
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

  if (IMAGE_MIME_TYPES.has(mimeType) || mimeType === PDF_MIME_TYPE) {
    return {
      part: { type: 'image_url', image_url: { url: toDataUri(bytes, mimeType), detail: 'auto' } },
      name: displayName,
      skipped: null,
    };
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
// default to all readable files. Extracted to keep readAttachments below
// the cognitive complexity limit.
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
  // [why] No specific names — fetch all readable files, newest first, capped.
  return allAttachments
    .filter((att) => isReadable(att.content_type ?? att.mime_type ?? 'application/octet-stream'))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_DEFAULT_FILES);
}

// [why] Process attachments and build the result message + content parts.
// Extracted to keep readAttachments below the cognitive complexity limit.
async function processAndBuildResult(
  selectedAttachments: AttachmentRow[],
  cardId: string
): Promise<{
  contentParts: BoardChatAssistContentPart[];
  message: string;
}> {
  const contentParts: BoardChatAssistContentPart[] = [];
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

  return { contentParts, message: messageLines.join('\n') };
}

export async function readAttachments(input: ReadAttachmentsInput): Promise<BoardChatAssistOutput> {
  const normalized = normalizeReadAttachmentsArguments(input.toolCall.function.arguments);
  if ('status' in normalized) return normalized;

  // [why] Resolve short ID → full UUID so the DB query works with either format.
  const resolvedId = await resolveCardId(normalized.card_id);
  if (!resolvedId) {
    return {
      status: 404,
      name: 'card-not-found',
      message: `No card found with ID "${normalized.card_id}".`,
    };
  }

  const allAttachments = await fetchAttachments(resolvedId);
  if (allAttachments.length === 0) {
    return {
      status: 200,
      data: {
        model: input.model,
        message: `Card "${normalized.card_id}" has no file attachments.`,
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
          `None of the requested file names matched attachments on card "${normalized.card_id}". ` +
          `Available files: ${allNames}`,
        ...(input.usage ? { usage: input.usage } : {}),
        toolCalls: [input.toolCall],
      },
    };
  }

  const { contentParts, message } = await processAndBuildResult(
    selectedAttachments,
    normalized.card_id
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
