const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function looksLikeUrlCandidate(value: string): boolean {
  if (!value || /\s/.test(value)) return false;
  if (URL_SCHEME_RE.test(value)) return true;
  return /^www\./i.test(value) || /^[^\s@]+\.[^\s@]+/.test(value);
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2) return word.toUpperCase();
      return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hostToDisplay(hostname: string): string {
  return hostname.replace(/^www\./i, '');
}

function pathSegmentToTitle(segment: string): string {
  const decoded = decodeUrlPart(segment)
    .replace(/\.[a-z0-9]{1,6}$/i, '')
    .replaceAll(/[+_-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

  // Ignore opaque or machine-like path IDs and fall back to hostname.
  if (decoded.length < 3) return '';
  if (/^[a-f0-9-]{8,}$/i.test(decoded)) return '';
  if (/^[0-9-]+$/.test(decoded)) return '';

  return toTitleCase(decoded);
}

export function normalizeHttpUrlInput(raw: string): string | null {
  const input = raw.trim();
  if (!looksLikeUrlCandidate(input)) return null;
  const href = URL_SCHEME_RE.test(input) ? input : `https://${input}`;

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  return parsed.toString();
}

export function getInlineTitleFromUrl(raw: string): string {
  const normalized = normalizeHttpUrlInput(raw);
  if (!normalized) return raw.trim();

  const parsed = new URL(normalized);
  const cleanHost = hostToDisplay(parsed.hostname);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const tail = segments.at(-1) ?? '';
  const titleFromPath = tail ? pathSegmentToTitle(tail) : '';

  if (titleFromPath) return titleFromPath;
  return cleanHost;
}
