import { describe, expect, it } from 'bun:test';
import {
  UNLIMITED_QUOTA,
  isUnlimited,
  exceeds,
  remaining,
  validate,
  percentageUsed,
} from '../../../server/common/limits';

describe('limits helpers', () => {
  describe('isUnlimited', () => {
    it('returns true for "unlimited" sentinel', () => {
      expect(isUnlimited('unlimited')).toBe(true);
      expect(isUnlimited(UNLIMITED_QUOTA)).toBe(true);
    });

    it('returns false for numeric quotas', () => {
      expect(isUnlimited(10)).toBe(false);
      expect(isUnlimited(0)).toBe(false);
      expect(isUnlimited(1000000)).toBe(false);
    });
  });

  describe('exceeds', () => {
    it('returns false when quota is unlimited', () => {
      expect(exceeds(0, 'unlimited')).toBe(false);
      expect(exceeds(999999, 'unlimited')).toBe(false);
    });

    it('returns false when usage is below quota', () => {
      expect(exceeds(5, 10)).toBe(false);
      expect(exceeds(0, 1)).toBe(false);
    });

    it('returns true when usage equals quota', () => {
      expect(exceeds(10, 10)).toBe(true);
    });

    it('returns true when usage exceeds quota', () => {
      expect(exceeds(11, 10)).toBe(true);
      expect(exceeds(1000, 10)).toBe(true);
    });

    it('handles edge case: usage 0, quota 0', () => {
      expect(exceeds(0, 0)).toBe(true);
    });
  });

  describe('remaining', () => {
    it('returns MAX_SAFE_INTEGER when quota is unlimited', () => {
      expect(remaining(0, 'unlimited')).toBe(Number.MAX_SAFE_INTEGER);
      expect(remaining(999999, 'unlimited')).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('returns (quota - usage) when usage < quota', () => {
      expect(remaining(5, 10)).toBe(5);
      expect(remaining(0, 10)).toBe(10);
      expect(remaining(9, 10)).toBe(1);
    });

    it('returns 0 when usage >= quota', () => {
      expect(remaining(10, 10)).toBe(0);
      expect(remaining(11, 10)).toBe(0);
    });

    it('never returns negative values', () => {
      expect(remaining(100, 10)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validate', () => {
    it('returns { valid: true } when quota is unlimited', () => {
      expect(validate(0, 'unlimited')).toEqual({ valid: true });
      expect(validate(999999, 'unlimited')).toEqual({ valid: true });
    });

    it('returns { valid: true } when usage < quota', () => {
      expect(validate(5, 10)).toEqual({ valid: true });
      expect(validate(0, 10)).toEqual({ valid: true });
    });

    it('returns { valid: false, remaining: 0, quota } when usage >= quota', () => {
      const result = validate(10, 10);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.remaining).toBe(0);
        expect(result.quota).toBe(10);
      }

      const result2 = validate(11, 10);
      expect(result2.valid).toBe(false);
      if (!result2.valid) {
        expect(result2.remaining).toBe(0);
        expect(result2.quota).toBe(10);
      }
    });
  });

  describe('percentageUsed', () => {
    it('returns 0 when quota is unlimited', () => {
      expect(percentageUsed(0, 'unlimited')).toBe(0);
      expect(percentageUsed(50, 'unlimited')).toBe(0);
    });

    it('returns 0 when usage is 0', () => {
      expect(percentageUsed(0, 100)).toBe(0);
    });

    it('returns 100 when usage equals quota', () => {
      expect(percentageUsed(10, 10)).toBe(100);
      expect(percentageUsed(100, 100)).toBe(100);
    });

    it('returns clamped percentage (0-100)', () => {
      expect(percentageUsed(5, 10)).toBe(50);
      expect(percentageUsed(2, 10)).toBe(20);
      expect(percentageUsed(99, 100)).toBe(99);

      // Clamped to max 100 if usage > quota
      expect(percentageUsed(11, 10)).toBe(100);
      expect(percentageUsed(200, 100)).toBe(100);
    });

    it('handles fractional percentages', () => {
      const pct = percentageUsed(1, 3);
      expect(pct).toBeGreaterThan(33);
      expect(pct).toBeLessThan(34);
    });
  });

  describe('integration scenarios', () => {
    it('free tier board quota scenario', () => {
      const freeMaxBoards = 5;
      const currentBoardCount = 4;

      expect(exceeds(currentBoardCount, freeMaxBoards)).toBe(false);
      expect(remaining(currentBoardCount, freeMaxBoards)).toBe(1);
      expect(percentageUsed(currentBoardCount, freeMaxBoards)).toBe(80);

      // Try to create one more (should fail)
      expect(exceeds(5, freeMaxBoards)).toBe(true);
      expect(remaining(5, freeMaxBoards)).toBe(0);
    });

    it('pro tier unlimited columns scenario', () => {
      const proMaxColumns = 'unlimited';
      const currentColumns = 10000;

      expect(exceeds(currentColumns, proMaxColumns)).toBe(false);
      expect(remaining(currentColumns, proMaxColumns)).toBe(Number.MAX_SAFE_INTEGER);
      expect(percentageUsed(currentColumns, proMaxColumns)).toBe(0);
    });

    it('rate limit scenario', () => {
      const readLimit = 100;
      const requestsPerMinute = 95;

      const validation = validate(requestsPerMinute, readLimit);
      expect(validation.valid).toBe(true);
      expect(remaining(requestsPerMinute, readLimit)).toBe(5);
    });
  });
});
