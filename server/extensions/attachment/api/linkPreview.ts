// GET /api/v1/link-preview?url=...
// Returns the page title and favicon URL for an external link.
// Auth required. SSRF protection reuses isForbiddenUrl from addUrl.ts.
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { isForbiddenUrl } from './addUrl';

const FETCH_TIMEOUT_MS = 5_000;
// Read at most 64 KB — enough to capture <head> with meta tags.
const HTML_LIMIT = 65_536;

export async function handleLinkPreview(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  const rawUrl = new URL(req.url).searchParams.get('url') ?? '';
  if (!rawUrl) {
    return Response.json({ name: 'bad-request', data: { message: 'url param required' } }, { status: 400 });
  }

  if (isForbiddenUrl(rawUrl)) {
    return Response.json(
      { name: 'url-target-forbidden', data: { message: 'URL targets a forbidden address' } },
      { status: 400 },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return Response.json({ name: 'invalid-url', data: { message: 'Invalid URL' } }, { status: 400 });
  }

  // Default favicon path — works for most sites without scraping HTML.
  const faviconUrl = `${parsed.origin}/favicon.ico`;
  const title = await fetchPageTitle(rawUrl);
  return Response.json({ data: { title: title ?? parsed.hostname, faviconUrl } });
}

/** Fetch up to HTML_LIMIT bytes from the URL and extract the page title. Returns null on failure. */
async function fetchPageTitle(rawUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChimeDeck/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!resp.ok || !(resp.headers.get('content-type') ?? '').includes('text/html')) return null;
    return extractTitle(await readLimitedHtml(resp)) ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Stream at most HTML_LIMIT bytes from a Response and decode as a string. */
async function readLimitedHtml(resp: Response): Promise<string> {
  const reader = resp.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  while (bytesRead < HTML_LIMIT) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytesRead += value.length;
  }
  reader.cancel().catch(() => {});
  const combined = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(combined);
}

function extractTitle(html: string): string | null {
  // og:title — try both attribute orderings
  const ogA = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,300})/i.exec(html);
  if (ogA?.[1]) return decodeEntities(ogA[1].trim());
  const ogB = /<meta[^>]+content=["']([^"']{1,300})[^>]*property=["']og:title["']/i.exec(html);
  if (ogB?.[1]) return decodeEntities(ogB[1].trim());
  // <title> fallback
  const titleMatch = /<title[^>]*>([^<]{1,300})<\/title>/is.exec(html);
  if (titleMatch?.[1]) return decodeEntities(titleMatch[1].trim());
  return null;
}

function decodeEntities(str: string): string {
  return str
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 10)));
}
