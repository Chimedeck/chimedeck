import { describe, expect, it } from 'bun:test';
import {
  isPublicApiRoute,
  shouldAttachAccessToken,
  shouldAttemptAuthRecovery,
} from './requestPolicy';

describe('requestPolicy', () => {
  it('treats login as a public endpoint', () => {
    expect(isPublicApiRoute({ url: '/auth/token', method: 'post' })).toBe(true);
    expect(shouldAttachAccessToken({ url: '/auth/token', method: 'post' })).toBe(false);
    expect(shouldAttemptAuthRecovery({ url: '/auth/token', method: 'post' })).toBe(false);
  });

  it('treats public auth callbacks as public even with the /api/v1 prefix and query string', () => {
    expect(
      isPublicApiRoute({
        url: '/api/v1/auth/verify-email?token=abc123',
        method: 'GET',
      }),
    ).toBe(true);
    expect(
      shouldAttemptAuthRecovery({
        url: 'https://example.com/api/v1/auth/confirm-email-change?token=abc123',
        method: 'GET',
      }),
    ).toBe(false);
  });

  it('treats invite inspection as public', () => {
    expect(isPublicApiRoute({ url: '/invites/token-123', method: 'GET' })).toBe(true);
    expect(shouldAttachAccessToken({ url: '/invites/token-123', method: 'GET' })).toBe(false);
  });

  it('keeps authenticated auth routes protected', () => {
    expect(isPublicApiRoute({ url: '/auth/change-email', method: 'POST' })).toBe(false);
    expect(shouldAttachAccessToken({ url: '/auth/change-email', method: 'POST' })).toBe(true);
    expect(shouldAttemptAuthRecovery({ url: '/auth/change-email', method: 'POST' })).toBe(true);
  });

  it('does not attempt auth recovery for refresh requests', () => {
    expect(shouldAttemptAuthRecovery({ url: '/auth/refresh', method: 'POST' })).toBe(false);
  });
});