// tests/integration/securityHeaders.test.ts
// Verifies that all required security headers are present on every HTTP response.
import { describe, it, expect, beforeAll } from 'bun:test';
import { applySecurityHeaders } from '../../server/mods/helmet';

describe('Security Headers', () => {
  let headers: Headers;

  beforeAll(() => {
    headers = new Headers();
    applySecurityHeaders(headers);
  });

  it('sets X-Frame-Options: DENY', () => {
    expect(headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('sets X-Content-Type-Options: nosniff', () => {
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets Referrer-Policy', () => {
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('sets Strict-Transport-Security with long max-age', () => {
    const hsts = headers.get('Strict-Transport-Security') ?? '';
    expect(hsts).toContain('max-age=');
    expect(hsts).toContain('includeSubDomains');
  });

  it('sets Content-Security-Policy that blocks inline scripts', () => {
    const csp = headers.get('Content-Security-Policy') ?? '';
    // Must not contain 'unsafe-inline' for scripts
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("script-src 'self'");
  });

  it('sets Permissions-Policy', () => {
    const pp = headers.get('Permissions-Policy') ?? '';
    expect(pp).toBeTruthy();
    expect(pp).toContain('camera=()');
  });
});
