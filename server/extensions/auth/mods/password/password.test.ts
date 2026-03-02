import { describe, expect, test, beforeAll } from 'bun:test';
import { hashPassword } from './hash';
import { verifyPassword } from './verify';

describe('password hashing', () => {
  let hash: string;

  beforeAll(async () => {
    hash = await hashPassword({ password: 'correct-horse-battery-staple' });
  });

  test('produces a non-empty bcrypt hash', () => {
    expect(hash).toBeTruthy();
    expect(hash.startsWith('$2')).toBe(true);
  });

  test('verifies correct password', async () => {
    const valid = await verifyPassword({ password: 'correct-horse-battery-staple', hash });
    expect(valid).toBe(true);
  });

  test('rejects wrong password', async () => {
    const valid = await verifyPassword({ password: 'wrong-password', hash });
    expect(valid).toBe(false);
  });
});
