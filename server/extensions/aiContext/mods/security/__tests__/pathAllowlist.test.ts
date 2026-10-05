// Tests for path allowlist validator.
import { describe, it, expect } from 'vitest';
import { validatePathAllowlist } from '../pathAllowlist';

describe('validatePathAllowlist', () => {
  it('returns null when no focus paths are provided', () => {
    const result = validatePathAllowlist({});
    expect(result).toBeNull();
  });

  it('returns null when focusPaths is empty', () => {
    const result = validatePathAllowlist({ focusPaths: [] });
    expect(result).toBeNull();
  });

  it('allows specs/ paths', () => {
    const result = validatePathAllowlist({
      focusPaths: ['specs/architecture/plugins.md'],
    });
    expect(result).toBeNull();
  });

  it('allows src/ paths', () => {
    const result = validatePathAllowlist({
      focusPaths: ['src/extensions/CardChat/components/CardChatDrawer.tsx'],
    });
    expect(result).toBeNull();
  });

  it('allows server/ paths', () => {
    const result = validatePathAllowlist({
      focusPaths: ['server/extensions/auth/index.ts'],
    });
    expect(result).toBeNull();
  });

  it('rejects path outside allowlist', () => {
    const result = validatePathAllowlist({
      focusPaths: ['.env'],
    });
    expect(result).toEqual({
      name: 'path-not-allowed',
      status: 403,
      message: 'Path ".env" is not in the allowlist',
    });
  });

  it('rejects one path when multiple provided', () => {
    const result = validatePathAllowlist({
      focusPaths: ['specs/architecture/plugins.md', '/etc/passwd'],
    });
    expect(result).toEqual({
      name: 'path-not-allowed',
      status: 403,
      message: expect.stringContaining('/etc/passwd'),
    });
  });

  it('rejects path traversing outside allowlist boundaries', () => {
    const result = validatePathAllowlist({
      focusPaths: ['../.env'],
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('path-not-allowed');
  });
});
