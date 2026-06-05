// Tests for the PEM/base64 decoder used by JWT and GitHub App keys.
//
// Covers the regression where malformed JWT keys in .env used to decode
// silently via Buffer.from(str, 'base64') and then explode deep inside
// jose with "Uint8Array.fromBase64 requires a valid base64 string" — a
// stack trace that gave the operator no clue that the problem was the
// env var. The new decoder throws with a message that names the exact
// env var to fix.
import { describe, expect, it } from 'bun:test';
import { decodeKey } from '../decodeKey';

const PEM = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ\n-----END PRIVATE KEY-----`;
const B64_PEM = Buffer.from(PEM, 'utf-8').toString('base64');

describe('decodeKey', () => {
  it('returns an empty string for empty input', () => {
    expect(decodeKey('', 'JWT_PRIVATE_KEY')).toBe('');
  });

  it('passes a raw PEM block through unchanged', () => {
    expect(decodeKey(PEM, 'JWT_PRIVATE_KEY')).toBe(PEM);
  });

  it('decodes a base64-encoded PEM back to the original PEM', () => {
    expect(decodeKey(B64_PEM, 'JWT_PRIVATE_KEY')).toBe(PEM);
  });

  it('strips whitespace from the base64 input before decoding', () => {
    // [why] Operators commonly paste the base64 with a trailing newline or
    // split it across lines for readability. Both shapes must work.
    const withNewline = `${B64_PEM}\n`;
    const withSpaces = B64_PEM.replace(/.{64}/g, (m) => `${m} `).trim();
    expect(decodeKey(withNewline, 'JWT_PRIVATE_KEY')).toBe(PEM);
    expect(decodeKey(withSpaces, 'JWT_PRIVATE_KEY')).toBe(PEM);
  });

  it('throws a named error when the input contains invalid base64 characters', () => {
    // [why] The original bug: a non-base64 string used to silently round-trip
    // through Buffer.from(str, 'base64') and produce garbage that later
    // crashed at first login. The new decoder must fail at boot instead.
    expect(() => decodeKey('this is not base64 nor PEM!!!', 'JWT_PRIVATE_KEY'))
      .toThrow(/JWT_PRIVATE_KEY contains invalid base64 characters/);
  });

  it('throws a named error when the decoded value is not a PEM block', () => {
    // [why] Some valid base64, but the decoded content is not a PEM. The
    // decoder catches this so a typo (e.g. wrong file base64-encoded) is
    // surfaced at boot rather than at first login.
    const notPem = Buffer.from('hello world', 'utf-8').toString('base64');
    expect(() => decodeKey(notPem, 'JWT_PRIVATE_KEY'))
      .toThrow(/does not look like a PEM block/);
  });

  it('names the offending env var in every error message', () => {
    // [why] Operators grep server logs for the env var name when triaging;
    // burying the name in a generic "bad key" message defeats that.
    expect(() => decodeKey('garbage', 'GITHUB_APP_PRIVATE_KEY'))
      .toThrow(/GITHUB_APP_PRIVATE_KEY/);
    const notPem = Buffer.from('hello world', 'utf-8').toString('base64');
    expect(() => decodeKey(notPem, 'STRIPE_SECRET_KEY'))
      .toThrow(/STRIPE_SECRET_KEY/);
  });
});
