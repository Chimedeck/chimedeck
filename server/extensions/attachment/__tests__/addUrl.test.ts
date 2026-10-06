import { describe, expect, test } from 'bun:test';
import { ReferencedCardError } from '../api/referencedCardError';

describe('ReferencedCardError', () => {
  test('preserves the API error response for a missing referenced card', async () => {
    const error = new ReferencedCardError(
      'referenced-card-not-found',
      'The linked card was not found',
      404,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.response.status).toBe(404);
    expect(await error.response.json()).toEqual({
      name: 'referenced-card-not-found',
      data: { message: 'The linked card was not found' },
    });
  });
});
