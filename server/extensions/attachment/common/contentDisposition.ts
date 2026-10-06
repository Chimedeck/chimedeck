// RFC 6266/5987: a quoted ASCII fallback plus the sanitized UTF-8 filename.
// Strip controls and path/quoted-string delimiters before building either value.
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME_CHARACTERS = /[\u0000-\u001F\u007F-\u009F"\\/]/g;
const COMBINING_MARKS = /[\u0300-\u036F]/g;
const RFC5987_EXTRA = /['()*]/g;

export type ContentDispositionType = 'inline' | 'attachment';

function toAsciiFallback(sanitized: string): string {
  const folded = sanitized.normalize('NFD').replace(COMBINING_MARKS, '');
  let fallback = '';
  for (const ch of folded) {
    fallback += ch >= '\u0020' && ch <= '\u007E' ? ch : '_';
  }
  return fallback || 'download';
}

function toRfc5987Value(sanitized: string): string {
  return encodeURIComponent(sanitized).replace(
    RFC5987_EXTRA,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
  );
}

export function buildContentDisposition(
  filename: string | null | undefined,
  disposition: ContentDispositionType = 'attachment'
): string | null {
  const sanitized = (filename ?? '')
    .replace(UNSAFE_FILENAME_CHARACTERS, '')
    // In Unicode mode this matches lone surrogates, preserving valid pairs.
    .replace(/[\uD800-\uDFFF]/gu, '\uFFFD')
    .trim();
  if (!sanitized || /^\.+$/.test(sanitized)) return null;

  return `${disposition}; filename="${toAsciiFallback(sanitized)}"; filename*=UTF-8''${toRfc5987Value(sanitized)}`;
}
