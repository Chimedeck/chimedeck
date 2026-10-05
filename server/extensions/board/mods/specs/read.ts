// Reads a single specs file from an absolute path and produces its content + ETag.
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { SpecsFileResult } from '../../types';

// Hard upper bound per file; callers that need a stricter limit can enforce it separately.
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MiB

export async function readSpecsFile({
  absolutePath,
}: {
  absolutePath: string;
}): Promise<SpecsFileResult> {
  const info = await stat(absolutePath);

  if (info.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('specs-file-too-large');
  }

  const buffer = await readFile(absolutePath);
  const content = buffer.toString('utf-8');
  const etag = createHash('sha256').update(buffer).digest('hex').slice(0, 32);

  return { content, etag, sizeBytes: info.size };
}
