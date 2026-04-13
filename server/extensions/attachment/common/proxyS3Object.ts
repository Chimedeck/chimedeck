import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, s3Config } from './config/s3';

function toReadableStream(body: unknown): ReadableStream<Uint8Array> | null {
  if (!body) return null;

  if (typeof (body as { transformToWebStream?: () => ReadableStream<Uint8Array> }).transformToWebStream === 'function') {
    return (body as { transformToWebStream: () => ReadableStream<Uint8Array> }).transformToWebStream();
  }

  if (body instanceof ReadableStream) return body as ReadableStream<Uint8Array>;

  const asyncIterable = body as AsyncIterable<Uint8Array>;
  if (typeof asyncIterable?.[Symbol.asyncIterator] !== 'function') return null;

  const iterator = asyncIterable[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    async cancel() {
      if (typeof iterator.return === 'function') {
        await iterator.return();
      }
    },
  });
}

export async function proxyS3Object({
  s3Key,
  fallbackContentType,
  fallbackFilename,
}: {
  s3Key: string;
  fallbackContentType?: string | null;
  fallbackFilename?: string | null;
}): Promise<Response> {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: s3Key,
    }),
  );

  const stream = toReadableStream(result.Body);
  if (!stream) {
    return Response.json({ name: 'attachment-read-failed', data: { message: 'Failed to read attachment from storage' } }, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', result.ContentType ?? fallbackContentType ?? 'application/octet-stream');
  if (result.ContentLength != null) headers.set('Content-Length', String(result.ContentLength));
  if (result.ETag) headers.set('ETag', result.ETag);
  if (result.LastModified) headers.set('Last-Modified', result.LastModified.toUTCString());
  // Private resources: avoid browser/proxy caching across users.
  headers.set('Cache-Control', 'private, no-store');

  const rawFilename = fallbackFilename?.trim();
  if (rawFilename) {
    const escapedFilename = rawFilename.replaceAll('"', '');
    headers.set('Content-Disposition', `inline; filename="${escapedFilename}"`);
  }

  return new Response(stream, { status: 200, headers });
}