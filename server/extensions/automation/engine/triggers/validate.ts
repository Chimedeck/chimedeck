// Trigger validation — validates trigger config against the registered handler's Zod schema.
// Called at automation create/update time to catch bad configs before they persist.

import { getTriggerHandler } from '../registry';

export interface TriggerValidationResult {
  valid: boolean;
  errorName?: string;
  errorData?: unknown;
}

export function validateTrigger(
  triggerType: string,
  config: unknown,
): TriggerValidationResult {
  const handler = getTriggerHandler(triggerType);
  if (!handler) {
    return { valid: false, errorName: 'trigger-type-unknown' };
  }

  const result = handler.configSchema.safeParse(config ?? {});
  if (!result.success) {
    return {
      valid: false,
      errorName: 'trigger-config-invalid',
      errorData: result.error.flatten(),
    };
  }

  return { valid: true };
}
