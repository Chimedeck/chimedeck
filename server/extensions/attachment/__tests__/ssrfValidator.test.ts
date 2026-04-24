// Unit tests for the SSRF URL validator (isForbiddenUrl).
import { describe, expect, test } from 'bun:test';
import { isForbiddenUrl, parseInternalCardUrl } from '../api/addUrl';

describe('isForbiddenUrl', () => {
  test('allows a normal public URL', () => {
    expect(isForbiddenUrl('https://example.com/file.pdf')).toBe(false);
  });

  test('blocks 127.0.0.1 (loopback)', () => {
    expect(isForbiddenUrl('http://127.0.0.1/secret')).toBe(true);
  });

  test('blocks 127.x.x.x range', () => {
    expect(isForbiddenUrl('http://127.0.0.2/secret')).toBe(true);
  });

  test('blocks 10.x.x.x (private class A)', () => {
    expect(isForbiddenUrl('http://10.0.0.1/')).toBe(true);
  });

  test('blocks 192.168.x.x (private class C)', () => {
    expect(isForbiddenUrl('http://192.168.1.1/')).toBe(true);
  });

  test('blocks 172.16.x.x (private class B start)', () => {
    expect(isForbiddenUrl('http://172.16.0.1/')).toBe(true);
  });

  test('blocks 172.31.x.x (private class B end)', () => {
    expect(isForbiddenUrl('http://172.31.255.255/')).toBe(true);
  });

  test('allows 172.15.x.x (not in private range)', () => {
    expect(isForbiddenUrl('http://172.15.0.1/')).toBe(false);
  });

  test('allows 172.32.x.x (not in private range)', () => {
    expect(isForbiddenUrl('http://172.32.0.1/')).toBe(false);
  });

  test('blocks 169.254.x.x (link-local)', () => {
    expect(isForbiddenUrl('http://169.254.169.254/latest/meta-data/')).toBe(true);
  });

  test('blocks IPv6 loopback ::1', () => {
    expect(isForbiddenUrl('http://[::1]/')).toBe(true);
  });

  test('rejects a malformed URL', () => {
    expect(isForbiddenUrl('not-a-url')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isForbiddenUrl('')).toBe(true);
  });
});

describe('parseInternalCardUrl', () => {
  test('parses short card route /c/:cardId', () => {
    expect(parseInternalCardUrl('https://app.example.com/c/Ab12Cd34')).toEqual({ cardId: 'Ab12Cd34' });
  });

  test('parses short card route with slug', () => {
    expect(parseInternalCardUrl('https://app.example.com/c/Ab12Cd34/some-card-title')).toEqual({ cardId: 'Ab12Cd34' });
  });

  test('parses legacy /boards/:boardId/cards/:cardId route', () => {
    expect(parseInternalCardUrl('https://app.example.com/boards/board-1/cards/card-22')).toEqual({ cardId: 'card-22' });
  });

  test('parses board route with ?card= query', () => {
    expect(parseInternalCardUrl('https://app.example.com/b/board-1?card=card-99')).toEqual({ cardId: 'card-99' });
  });

  test('returns null for non-card URLs', () => {
    expect(parseInternalCardUrl('https://app.example.com/b/board-1')).toBeNull();
    expect(parseInternalCardUrl('https://app.example.com/somewhere-else')).toBeNull();
  });
});
