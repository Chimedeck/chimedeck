import { describe, expect, test } from 'bun:test';
import { defaults } from './defaults';

describe('feature flags defaults', () => {
  test('USE_REDIS defaults to true', () => {
    expect(defaults['USE_REDIS']).toBe(true);
  });

  test('VIRUS_SCAN_ENABLED defaults to true', () => {
    expect(defaults['VIRUS_SCAN_ENABLED']).toBe(true);
  });
});
