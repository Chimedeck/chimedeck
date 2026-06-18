import type {
  AllowedNextState,
  StateTransitionRejectionReason,
} from '../hooks/useStateTransitionGuard';

interface StateTransitionForbiddenPayload {
  name?: string;
  data?: {
    fromListId?: string;
    fromListName?: string;
    toListId?: string;
    toListName?: string;
    allowedNextStates?: Array<{ id?: string; name?: string }>;
  };
}

export function extractStateTransitionRejectionFromError({
  error,
  fallback,
}: {
  error: unknown;
  fallback: {
    fromListId: string;
    fromListName: string;
    toListId: string;
    toListName: string;
  };
}): StateTransitionRejectionReason | null {
  const response = (
    error as { response?: { status?: number; data?: StateTransitionForbiddenPayload } }
  ).response;
  if (response?.status !== 422) return null;
  if (response.data?.name !== 'state-transition-forbidden') return null;

  const allowedNextStates: AllowedNextState[] = (response.data.data?.allowedNextStates ?? [])
    .filter(
      (entry): entry is { id: string; name: string } =>
        typeof entry.id === 'string' && typeof entry.name === 'string'
    )
    .map((entry) => ({ id: entry.id, name: entry.name }));

  return {
    fromListId: response.data.data?.fromListId ?? fallback.fromListId,
    fromListName: response.data.data?.fromListName ?? fallback.fromListName,
    toListId: response.data.data?.toListId ?? fallback.toListId,
    toListName: response.data.data?.toListName ?? fallback.toListName,
    allowedNextStates,
  };
}
