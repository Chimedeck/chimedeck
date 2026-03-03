// server/mods/imageProcessor/index.ts
// Resizes an uploaded image to a 256×256 square cover crop using sharp.
// Falls back to returning the original buffer when sharp is unavailable (e.g. test env).

let sharpLib: typeof import('sharp') | null = null;

async function loadSharp(): Promise<typeof import('sharp') | null> {
  if (sharpLib !== null) return sharpLib;
  try {
    sharpLib = (await import('sharp')).default;
    return sharpLib;
  } catch {
    return null;
  }
}

const AVATAR_SIZE = 256;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function isValidAvatarFile({
  mimeType,
  sizeBytes,
}: {
  mimeType: string;
  sizeBytes: number;
}): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType) && sizeBytes <= MAX_SIZE_BYTES;
}

export async function resizeAvatar({
  buffer,
  mimeType,
}: {
  buffer: Buffer;
  mimeType: string;
}): Promise<Buffer> {
  const sharp = await loadSharp();

  if (!sharp) {
    // No sharp available — return original buffer unchanged
    return buffer;
  }

  const outputFormat = mimeType === 'image/webp' ? 'webp' : 'jpeg';

  return sharp(buffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
    .toFormat(outputFormat, { quality: 85 })
    .toBuffer();
}

export function avatarExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}
