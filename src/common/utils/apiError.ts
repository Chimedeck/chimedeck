// Standard API error envelope emitted by the server for all 4xx/5xx responses.
// Shape: { error: { code: string; message: string } }

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: ApiError;
}

/**
 * Type guard for Axios-style error objects that carry the ApiErrorEnvelope.
 * Use to extract error.code and error.message from caught thunk errors.
 */
export function isApiError(
  err: unknown
): err is { response: { status: number; data: ApiErrorEnvelope } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as Record<string, unknown>)['response'] === 'object'
  );
}

/** Extract the error code from a caught API error, falling back to a default. */
export const getApiErrorCode = (err: unknown, fallback: string): string => {
  if (isApiError(err)) {
    return err.response.data.error?.code ?? fallback;
  }
  return fallback;
};
