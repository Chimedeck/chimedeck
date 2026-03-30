import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock the Sentry module before importing errorHandler so captureError can be spied on.
const captureErrorMock = mock(() => {});
mock.module('../../../../../server/common/monitoring/sentry', () => ({
  captureError: captureErrorMock,
}));

const { handleUnhandledError } = await import(
  '../../../../../server/common/middlewares/errorHandler'
);

beforeEach(() => {
  captureErrorMock.mockClear();
});

describe('handleUnhandledError()', () => {
  it('returns a 500 JSON response in the API error envelope', async () => {
    const response = handleUnhandledError(new Error('boom'));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: 'internal-server-error', message: 'boom' },
    });
  });

  it('calls captureError with the thrown error', () => {
    const err = new Error('something went wrong');
    handleUnhandledError(err);

    expect(captureErrorMock).toHaveBeenCalledTimes(1);
    expect(captureErrorMock).toHaveBeenCalledWith(err);
  });

  it('uses a generic message for non-Error values', async () => {
    const response = handleUnhandledError('plain string throw');

    const body = await response.json();
    expect(body.error.code).toBe('internal-server-error');
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('still calls captureError for non-Error thrown values', () => {
    handleUnhandledError({ weird: 'object' });

    expect(captureErrorMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the error message from Error instances', async () => {
    const response = handleUnhandledError(new TypeError('type mismatch'));

    const body = await response.json();
    expect(body.error.message).toBe('type mismatch');
  });
});
