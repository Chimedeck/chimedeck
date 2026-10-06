// Regression test: server-side S3 operations must use S3_INTERNAL_ENDPOINT while
// browser-facing presigns keep using S3_ENDPOINT.
//
// Reproduces a production race where a presigned PUT through the public
// endpoint (https://public-object-store.example.test) succeeded, but the
// immediate server HeadObject through the same public proxy returned
// 403/Unknown while the same HeadObject against the internal object-store
// endpoint (http://object-store:9000) returned 200. Server object
// operations must not hairpin through the public proxy.
//
// The S3 clients are module singletons, so the env vars must be set before any
// module in this process imports the config. When this file runs as part of the
// wider suite another test file may already have cached the singleton with
// different env — therefore the assertions run in a spawned, isolated `bun test`
// child process (S3_SPLIT_TEST_INNER=1) whose env is fixed up front.
import { describe, test, expect } from 'bun:test';

const INNER = Bun.env['S3_SPLIT_TEST_INNER'] === '1';

const PUBLIC_ENDPOINT = 'https://public-object-store.example.test';
const INTERNAL_ENDPOINT = 'http://object-store:9000';

function childEnv(): Record<string, string> {
  return {
    ...(Bun.env as Record<string, string>),
    S3_SPLIT_TEST_INNER: '1',
    S3_ENDPOINT: PUBLIC_ENDPOINT,
    S3_INTERNAL_ENDPOINT: INTERNAL_ENDPOINT,
    S3_AWS_ACCESS_KEY_ID: 'test',
    S3_AWS_SECRET_ACCESS_KEY: 'test',
  };
}

if (INNER) {
  // ─── Isolated child process: singleton assertions ────────────────────────────
  const { s3Client, s3ServerClient, s3Config } = await import('./s3');
  const { presignGetUrl } = await import('../presign');
  const { headObject } = await import('../../mods/s3/headObject');

  async function resolvedEndpoint(clientInput: unknown): Promise<string | undefined> {
    const config = (clientInput as { config?: { endpoint?: unknown } }).config;
    const provider = config?.endpoint;
    if (typeof provider !== 'function') return undefined;
    const endpoint = await (provider as () => Promise<unknown>)();
    if (endpoint == null) return undefined;
    if (typeof endpoint === 'string') return endpoint;
    const parsed = endpoint as {
      url?: { toString(): string };
      protocol?: string;
      hostname?: string;
      port?: number;
    };
    if (parsed.url) return parsed.url.toString();
    if (parsed.hostname) {
      const port = parsed.port ? `:${String(parsed.port)}` : '';
      return `${parsed.protocol ?? 'https:'}//${parsed.hostname}${port}`;
    }
    return undefined;
  }

  describe('S3 public/internal endpoint split (inner)', () => {
    test('presign client keeps using the public S3_ENDPOINT', async () => {
      expect(await resolvedEndpoint(s3Client)).toBe(PUBLIC_ENDPOINT);
    });

    test('a server client exists and uses S3_INTERNAL_ENDPOINT for direct operations', async () => {
      expect(s3ServerClient).toBeDefined();
      expect(await resolvedEndpoint(s3ServerClient)).toBe(INTERNAL_ENDPOINT);
    });

    test('presigned GET URLs are generated against the public endpoint', async () => {
      const { url } = await presignGetUrl({ s3Key: 'attachments/card/file.png' });
      expect(url.startsWith(`${PUBLIC_ENDPOINT}/`)).toBe(true);
    });

    test('headObject sends through the server client, not the public client', async () => {
      const serverSends: Array<{ Bucket?: string; Key?: string }> = [];
      let publicSends = 0;
      const originalServerSend = s3ServerClient.send.bind(s3ServerClient);
      const originalPublicSend = s3Client.send.bind(s3Client);

      const serverSpy = s3ServerClient as unknown as Record<string, unknown>;
      const publicSpy = s3Client as unknown as Record<string, unknown>;
      serverSpy['send'] = (cmd: unknown) => {
        const input = (cmd as { input?: { Bucket?: string; Key?: string } }).input;
        serverSends.push({ Bucket: input?.Bucket ?? '', Key: input?.Key ?? '' });
        return Promise.resolve({});
      };
      publicSpy['send'] = () => {
        publicSends += 1;
        return Promise.reject(
          new Error('public client must not be used for direct object operations')
        );
      };

      try {
        const exists = await headObject({ s3Key: 'attachments/card/file.png' });
        expect(exists).toBe(true);
        expect(serverSends.length).toBe(1);
        expect(publicSends).toBe(0);
        expect(serverSends[0]?.Bucket).toBe(s3Config.bucket);
        expect(serverSends[0]?.Key).toBe('attachments/card/file.png');
      } finally {
        serverSpy['send'] = originalServerSend;
        publicSpy['send'] = originalPublicSend;
      }
    });
  });
} else {
  // ─── Outer runner: spawn the isolated child and gate on its result ──────────
  describe('S3 public/internal endpoint split', () => {
    test('isolated endpoint-split suite passes (see child output on failure)', async () => {
      const proc = Bun.spawn(['bun', 'test', import.meta.path], {
        env: childEnv(),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const code = await proc.exited;
      if (code !== 0) {
        console.error(stdout + stderr);
      }
      expect(code).toBe(0);
    });
  });
}
