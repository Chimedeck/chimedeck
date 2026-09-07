import { trelloError } from '../common/errors';

type TrelloErrorLike = {
  status?: number;
  message?: string;
  error?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toTrelloErrorResponse(error: unknown): Response {
  if (error instanceof Response) return error;

  if (isObject(error)) {
    const maybeError = error as TrelloErrorLike;
    const status = typeof maybeError.status === 'number' ? maybeError.status : 500;
    const message = typeof maybeError.message === 'string' && maybeError.message.trim()
      ? maybeError.message
      : 'An unexpected error occurred.';
    return trelloError(message, status);
  }

  if (error instanceof Error && error.message.trim()) {
    return trelloError(error.message, 500);
  }

  return trelloError('An unexpected error occurred.', 500);
}

export async function withTrelloErrorHandler(
  callback: () => Promise<Response | null>,
): Promise<Response | null> {
  try {
    return await callback();
  } catch (error) {
    return toTrelloErrorResponse(error);
  }
}
