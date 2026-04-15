// GET /api/v1/webhooks/event-types — returns the canonical list of supported event types.
// Authenticated endpoint — the UI uses this to build the event-type checklist.
import { authenticate, type AuthenticatedRequest } from '../../auth/middlewares/authentication';
import { WEBHOOK_EVENT_TYPES } from '../common/eventTypes';

export async function handleListEventTypes(req: Request): Promise<Response> {
  const authError = await authenticate(req as AuthenticatedRequest);
  if (authError) return authError;

  return Response.json({ data: [...WEBHOOK_EVENT_TYPES] });
}
