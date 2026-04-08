// Returns a stable proxy path for a board background, or the raw value for non-S3 backgrounds.
import { s3Config } from '../../attachment/common/config/s3';

const BACKGROUND_URL_TTL_SECONDS = 15 * 60; // 15 minutes — kept for reference, no longer used here

export function extractS3KeyFromBackgroundUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname);

    // Path-style: <endpoint>/<bucket>/<key>
    if (pathname.startsWith(`/${s3Config.bucket}/`)) {
      return pathname.slice(s3Config.bucket.length + 2);
    }

    // Virtual-hosted style: <bucket>.s3.<region>.amazonaws.com/<key>
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

/**
 * Returns a stable proxy path for the board's background image, or the raw value for
 * non-S3 backgrounds (e.g. CSS colour strings). Never generates presigned URLs — the
 * actual presigning happens inside the GET /api/v1/boards/:id/background proxy endpoint.
 */
export function resolveBackgroundUrl({
  boardId,
  backgroundUrl,
}: {
  boardId: string;
  backgroundUrl: string | null | undefined;
}): string | null {
  if (!backgroundUrl) return null;

  const s3Key = extractS3KeyFromBackgroundUrl(backgroundUrl);
  // Non-S3 backgrounds (colour values, external URLs) are returned as-is.
  if (!s3Key) return backgroundUrl;

  return `/api/v1/boards/${boardId}/background`;
}
