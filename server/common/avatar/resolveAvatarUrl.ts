import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, s3Config } from '../../extensions/attachment/common/config/s3';

const AVATAR_URL_TTL_SECONDS = 15 * 60;

export function extractS3KeyFromAvatarUrl({ avatarUrl }: { avatarUrl: string }): string | null {
  if (!avatarUrl) return null;

  // Support raw stored keys so callers can persist just the key if needed.
  if (!avatarUrl.includes('://')) {
    return avatarUrl.startsWith('avatars/') ? avatarUrl : null;
  }

  try {
    const parsed = new URL(avatarUrl);
    const pathname = decodeURIComponent(parsed.pathname || '');

    // Path-style URL: <endpoint>/<bucket>/<key>
    if (pathname.startsWith(`/${s3Config.bucket}/`)) {
      return pathname.slice(s3Config.bucket.length + 2);
    }

    // Virtual-hosted style URL: <bucket>.s3.<region>.amazonaws.com/<key>
    if (parsed.hostname === `${s3Config.bucket}.s3.amazonaws.com` || parsed.hostname.startsWith(`${s3Config.bucket}.s3.`)) {
      return pathname.replace(/^\/+/, '');
    }

    return null;
  } catch {
    return null;
  }
}

export async function resolveAvatarUrl({
  avatarUrl,
  ttlSeconds = AVATAR_URL_TTL_SECONDS,
}: {
  avatarUrl: string | null | undefined;
  ttlSeconds?: number;
}): Promise<string | null> {
  if (!avatarUrl) return null;

  const s3Key = extractS3KeyFromAvatarUrl({ avatarUrl });
  if (!s3Key) return avatarUrl;

  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: s3Key,
      }),
      { expiresIn: ttlSeconds },
    );
  } catch {
    // Fall back to the stored URL to avoid breaking profile rendering.
    return avatarUrl;
  }
}

/**
 * Returns the stable proxy path for a user's avatar.
 * Use this in API responses instead of resolveAvatarUrl to avoid leaking
 * short-lived presigned S3 URLs — the browser always hits the proxy endpoint.
 * Returns null when the user has no avatar stored.
 */
export function buildAvatarProxyUrl({
  userId,
  avatarUrl,
}: {
  userId: string;
  avatarUrl: string | null | undefined;
}): string | null {
  if (!avatarUrl) return null;
  return `/api/v1/users/${userId}/avatar`;
}

export async function resolveAvatarUrlsInCollection<T extends { avatar_url?: string | null }>(
  items: T[],
): Promise<T[]> {
  const cache = new Map<string, string | null>();

  return Promise.all(
    items.map(async (item) => {
      const rawAvatarUrl = item.avatar_url ?? null;
      if (!rawAvatarUrl) {
        return { ...item, avatar_url: null };
      }

      if (!cache.has(rawAvatarUrl)) {
        cache.set(rawAvatarUrl, await resolveAvatarUrl({ avatarUrl: rawAvatarUrl }));
      }

      return { ...item, avatar_url: cache.get(rawAvatarUrl) ?? null };
    }),
  );
}

/**
 * Maps a collection of user-like objects to use stable proxy avatar paths.
 * Replaces avatar_url with /api/v1/users/:id/avatar when the user has an avatar stored.
 * Synchronous — no S3 presigning needed.
 */
export function buildAvatarProxyUrlsInCollection<T extends Record<string, unknown>>(
  items: T[],
): T[] {
  return items.map((item) => {
    const id = item['id'] as string | undefined;
    const avatarUrl = item['avatar_url'] as string | null | undefined;
    return {
      ...item,
      avatar_url: id ? buildAvatarProxyUrl({ userId: id, avatarUrl: avatarUrl ?? null }) : null,
    };
  });
}
