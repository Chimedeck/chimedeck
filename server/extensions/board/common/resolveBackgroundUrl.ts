// Resolves a stored S3 board background URL to a presigned GET URL.
// Mirrors the pattern used for avatar URLs (server/common/avatar/resolveAvatarUrl.ts).
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, s3Config } from '../../attachment/common/config/s3';

const BACKGROUND_URL_TTL_SECONDS = 15 * 60; // 15 minutes

function extractS3KeyFromBackgroundUrl(url: string): string | null {
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

export async function resolveBackgroundUrl(
  backgroundUrl: string | null | undefined,
): Promise<string | null> {
  if (!backgroundUrl) return null;

  // LocalStack/custom endpoints are reachable directly in dev — skip presigning.
  if (s3Config.endpoint) return backgroundUrl;

  const s3Key = extractS3KeyFromBackgroundUrl(backgroundUrl);
  if (!s3Key) return backgroundUrl;

  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: s3Config.bucket, Key: s3Key }),
      { expiresIn: BACKGROUND_URL_TTL_SECONDS },
    );
  } catch {
    // Fall back to the stored URL to avoid breaking board rendering.
    return backgroundUrl;
  }
}
