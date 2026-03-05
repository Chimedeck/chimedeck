// server/extensions/plugins/api/__tests__/whitelisted-domains.test.ts
// Unit tests for plugin whitelistedDomains validation and board allowed-domains endpoint.
import { describe, it, expect } from 'bun:test';
import { isValidHttpsOrigin } from '../../common/isValidHttpsOrigin';

// ─── isValidHttpsOrigin ───────────────────────────────────────────────────────

describe('isValidHttpsOrigin', () => {
  it('accepts a bare HTTPS hostname', () => {
    expect(isValidHttpsOrigin('https://api.stripe.com')).toBe(true);
  });

  it('accepts HTTPS with a non-standard port', () => {
    expect(isValidHttpsOrigin('https://example.com:8443')).toBe(true);
  });

  it('rejects HTTP origins', () => {
    expect(isValidHttpsOrigin('http://example.com')).toBe(false);
  });

  it('rejects bare "https://"', () => {
    expect(isValidHttpsOrigin('https://')).toBe(false);
  });

  it('rejects an origin with a path', () => {
    expect(isValidHttpsOrigin('https://example.com/path')).toBe(false);
  });

  it('rejects an origin with a query string', () => {
    expect(isValidHttpsOrigin('https://example.com?foo=bar')).toBe(false);
  });

  it('rejects an origin with a hash fragment', () => {
    expect(isValidHttpsOrigin('https://example.com#section')).toBe(false);
  });

  it('rejects a non-URL string', () => {
    expect(isValidHttpsOrigin('not-a-url')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidHttpsOrigin('')).toBe(false);
  });
});
