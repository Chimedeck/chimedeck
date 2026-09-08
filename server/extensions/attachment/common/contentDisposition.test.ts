// Unit tests for Unicode-safe Content-Disposition header building.
// Covers: diacritics, emoji, apostrophes/parentheses, quote/backslash
// stripping, CRLF/control stripping, inline vs attachment, ASCII-only
// output, RFC 5987 `filename*=UTF-8''...` encoding (including `'()*`),
// and construction of a real Headers/Response without throwing.
import { describe, expect, it } from 'bun:test';

import { buildContentDisposition } from './contentDisposition';

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;
const HEADER_SHAPE = /^(inline|attachment); filename="[^"]*"; filename\*=UTF-8''[!-~]+$/;

describe('buildContentDisposition', () => {
  it('returns null when no usable filename is provided', () => {
    expect(buildContentDisposition(null)).toBeNull();
    expect(buildContentDisposition(undefined)).toBeNull();
    expect(buildContentDisposition('')).toBeNull();
    expect(buildContentDisposition('   ')).toBeNull();
    expect(buildContentDisposition('"\r\n"')).toBeNull();
  });

  it('defaults to attachment and keeps plain ASCII names unchanged', () => {
    expect(buildContentDisposition('report.pdf')).toBe(
      'attachment; filename="report.pdf"; filename*=UTF-8\'\'report.pdf'
    );
  });

  it('supports the inline disposition', () => {
    expect(buildContentDisposition('preview.png', 'inline')).toBe(
      'inline; filename="preview.png"; filename*=UTF-8\'\'preview.png'
    );
  });

  it('folds diacritics to a deterministic ASCII fallback', () => {
    expect(buildContentDisposition('café.pdf')).toBe(
      'attachment; filename="cafe.pdf"; filename*=UTF-8\'\'caf%C3%A9.pdf'
    );
    expect(buildContentDisposition('João.jpg')).toBe(
      'attachment; filename="Joao.jpg"; filename*=UTF-8\'\'Jo%C3%A3o.jpg'
    );
  });

  it('replaces non-Latin characters with underscores in the fallback', () => {
    expect(buildContentDisposition('文档.pdf')).toBe(
      'attachment; filename="__.pdf"; filename*=UTF-8\'\'%E6%96%87%E6%A1%A3.pdf'
    );
  });

  it('replaces emoji with an underscore in the fallback and encodes them for filename*', () => {
    expect(buildContentDisposition('📊 report.xlsx')).toBe(
      'attachment; filename="_ report.xlsx"; filename*=UTF-8\'\'%F0%9F%93%8A%20report.xlsx'
    );
  });

  it('keeps apostrophes and parentheses in the quoted fallback but encodes them for filename*', () => {
    expect(buildContentDisposition("John's (final).txt")).toBe(
      "attachment; filename=\"John's (final).txt\"; filename*=UTF-8''John%27s%20%28final%29.txt"
    );
  });

  it("encodes the RFC 5987 reserved characters '()* and %", () => {
    expect(buildContentDisposition('star*100%.pdf')).toBe(
      'attachment; filename="star*100%.pdf"; filename*=UTF-8\'\'star%2A100%25.pdf'
    );
  });

  it('strips double quotes and backslashes from both variants', () => {
    expect(buildContentDisposition('a"b\\c.pdf')).toBe(
      'attachment; filename="abc.pdf"; filename*=UTF-8\'\'abc.pdf'
    );
  });

  it('strips CRLF and other control characters', () => {
    expect(buildContentDisposition('bad\r\nname.pdf')).toBe(
      'attachment; filename="badname.pdf"; filename*=UTF-8\'\'badname.pdf'
    );
    expect(buildContentDisposition('\u0000\u001Fx.pdf\u007F')).toBe(
      'attachment; filename="x.pdf"; filename*=UTF-8\'\'x.pdf'
    );
  });

  it('strips path separators and C1 controls', () => {
    expect(buildContentDisposition('folder/report\u0085.pdf')).toBe(
      'attachment; filename="folderreport.pdf"; filename*=UTF-8\'\'folderreport.pdf'
    );
  });

  it('handles degenerate and malformed names deterministically', () => {
    for (const name of ['/', '\\', '.', '..', ' /..\\ ']) {
      expect(buildContentDisposition(name)).toBeNull();
    }
    expect(buildContentDisposition('\u0301')).toBe(
      'attachment; filename="download"; filename*=UTF-8\'\'%CC%81'
    );
    expect(buildContentDisposition('bad\uD800.txt')).toBe(
      'attachment; filename="bad_.txt"; filename*=UTF-8\'\'bad%EF%BF%BD.txt'
    );
  });

  it('always produces printable-ASCII-only header values', () => {
    const gnarly = [
      'café.pdf',
      '📊 report.xlsx',
      "John's (final).txt",
      'a"b\\c.pdf',
      'bad\r\nname.pdf',
      '文档.pdf',
      'Ünïcödé (tüfe).txt',
      "emoji 🎉 'quote' (paren) *star*.bin",
    ];
    for (const name of gnarly) {
      const header = buildContentDisposition(name);
      expect(header).not.toBeNull();
      expect(header).toMatch(PRINTABLE_ASCII);
      expect(header).toMatch(HEADER_SHAPE);
    }
  });

  it('builds a real Headers object and Response without throwing', () => {
    const header = buildContentDisposition('📊 résumé (final) "v2"\r\n.pdf');
    expect(header).not.toBeNull();

    const headers = new Headers();
    expect(() => {
      headers.set('Content-Disposition', header as string);
    }).not.toThrow();
    expect(headers.get('Content-Disposition')).toBe(header);
    expect(() => new Response(null, { headers })).not.toThrow();
  });

  it('percent-encoded filename* decodes back to the sanitized original', () => {
    const header = buildContentDisposition('📊 résumé (final) "v2"\r\n.pdf');
    const encoded = (header as string).match(/filename\*=UTF-8''(.+)$/)?.[1];
    expect(encoded).toBeDefined();
    expect(decodeURIComponent(encoded as string)).toBe('📊 résumé (final) v2.pdf');
  });
});
