// GET /api/v1/automation/action-types
// Returns all registered action types with their JSON Schema config shape and category.
// Used by the Rules Builder UI to dynamically render the action picker and config form.

import { z } from 'zod';
import { getAllActionHandlers } from '../engine/registry';
// Ensure all actions are registered before this endpoint is called.
import '../engine/actions/index';

export function handleGetActionTypes(_req: Request): Response {
  const handlers = getAllActionHandlers();

  const data = handlers.map((handler) => ({
    type: handler.type,
    label: handler.label ?? handler.type,
    category: handler.category ?? 'card',
    configSchema: z.toJSONSchema(handler.configSchema),
  }));

  return Response.json({ data });
}
