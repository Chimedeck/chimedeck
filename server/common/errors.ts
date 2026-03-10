// Shared error envelope factory.
// All API error responses must use this shape: { error: { code, message } }
// instead of the legacy { name, data: { message } } format.

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: ApiError;
}

/** Build a standard error response body: { error: { code, message } } */
export const apiError = (code: string, message: string): ApiErrorEnvelope => ({
  error: { code, message },
});
