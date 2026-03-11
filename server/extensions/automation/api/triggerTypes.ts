// GET /api/v1/automation/trigger-types
// Returns all registered trigger types with their JSON Schema config shape.
// Used by the Rules Builder UI to dynamically render the trigger picker and config form.

import { z } from 'zod';
import { getAllTriggerHandlers } from '../engine/registry';
// Ensure all triggers are registered before this endpoint is called.
import '../engine/triggers/index';

export function handleGetTriggerTypes(_req: Request): Response {
  const handlers = getAllTriggerHandlers();

  const data = handlers.map((handler) => ({
    type: handler.type,
    label: handler.label,
    configSchema: z.toJSONSchema(handler.configSchema),
  }));

  return Response.json({ data });
}
