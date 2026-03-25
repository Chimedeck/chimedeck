// POST /api/v1/boards/:id/background — upload a background image to S3.
// Only JPEG and PNG are accepted; max 10 MB. Owner/Admin/Member may call this.
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../../../common/db';
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import {
  requireWorkspaceMembership,
  requireRole,
  type WorkspaceScopedRequest,
} from '../../../middlewares/permissionManager';
import { requireBoardWritable, type BoardScopedRequest } from '../middlewares/requireBoardWritable';
import { s3Client, s3Config } from '../../attachment/common/config/s3';
import { deleteObject } from '../../attachment/mods/s3/deleteObject';
import { env } from '../../../config/env';
import { resolveBackgroundUrl } from '../common/resolveBackgroundUrl';
import { writeEvent } from '../../../mods/events/write';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function buildPublicUrl(s3Key: string): string {
  const baseUrl = env.S3_ENDPOINT
    ? `${env.S3_ENDPOINT}/${s3Config.bucket}`
    : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
  return `${baseUrl}/${s3Key}`;
}

function extractS3KeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);
    if (pathname.startsWith(`/${s3Config.bucket}/`)) {
      return pathname.slice(s3Config.bucket.length + 2);
    }
    if (
      parsed.hostname === `${s3Config.bucket}.s3.amazonaws.com` ||
      parsed.hostname.startsWith(`${s3Config.bucket}.s3.`)
    ) {
      return pathname.replace(/^\/+/, '');
    }
    return null;
  } catch {
    return null;
  }
}

export async function handleUploadBackground(req: Request, boardId: string): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const boardScopedReq = req as BoardScopedRequest;
  const writableError = await requireBoardWritable(boardScopedReq, boardId);
  if (writableError) return writableError;

  const board = boardScopedReq.board!;
  const scopedReq = req as WorkspaceScopedRequest;
  const membershipError = await requireWorkspaceMembership(scopedReq, board.workspace_id);
  if (membershipError) return membershipError;

  const roleError = requireRole(scopedReq, 'MEMBER');
  if (roleError) return roleError;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: { code: 'bad-request', message: 'Expected multipart/form-data' } },
      { status: 400 },
    );
  }

  const file = formData.get('background');
  if (!(file instanceof File)) {
    return Response.json(
      { error: { code: 'bad-request', message: 'Missing background field' } },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return Response.json(
      { name: 'mime-type-not-allowed', data: { mimeType: file.type } },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return Response.json(
      { name: 'file-too-large', data: { sizeBytes: file.size, maxBytes: MAX_SIZE_BYTES } },
      { status: 413 },
    );
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const s3Key = `board-backgrounds/${boardId}/background.${ext}`;

  // Remove previous background from S3 if it exists
  const existingBoard = await db('boards').where({ id: boardId }).first();
  if (existingBoard?.background) {
    try {
      const oldKey = extractS3KeyFromUrl(existingBoard.background);
      if (oldKey) await deleteObject({ s3Key: oldKey });
    } catch {
      // Non-fatal — old file may already be gone
    }
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: s3Key,
      Body: rawBuffer,
      ContentType: file.type,
    }),
  );

  const backgroundUrl = buildPublicUrl(s3Key);
  const [updated] = await db('boards')
    .where({ id: boardId })
    .update({ background: backgroundUrl }, ['*']);

  await writeEvent({
    type: 'board.background_changed',
    boardId,
    entityId: boardId,
    actorId: (req as AuthenticatedRequest).currentUser?.id ?? 'system',
    payload: { background: backgroundUrl },
  });

  const resolvedBackground = resolveBackgroundUrl({ boardId, backgroundUrl: updated.background });
  return Response.json({ data: { ...updated, background: resolvedBackground } });
}
