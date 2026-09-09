import { describe, expect, it } from 'bun:test';
import type { ActionHandler, TriggerHandler } from '../../../server/extensions/automation/common/types';
import { cardRemoveLabelAction } from '../../../server/extensions/automation/engine/actions/card/removeLabel';
import { cardCreatedTrigger } from '../../../server/extensions/automation/engine/triggers/card/created';

// Exercise real schemas through the shared handler interfaces, without DB or registry mocks.
const action: ActionHandler = cardRemoveLabelAction;
const trigger: TriggerHandler = cardCreatedTrigger;

describe('Shared automation handler schemas', () => {
  it('preserves the optional trigger filter and strips unknown config keys', () => {
    expect(trigger.configSchema.parse({ ignored: true })).toEqual({});
    expect(trigger.configSchema.parse({ listIds: ['list-1'] })).toEqual({ listIds: ['list-1'] });
  });

  it('rejects malformed trigger filters through the shared schema boundary', () => {
    expect(trigger.configSchema.safeParse({ listIds: [42] }).success).toBe(false);
    expect(trigger.configSchema.safeParse({ listIds: [''] }).success).toBe(false);
  });

  it('preserves required action config validation and parsed output', () => {
    expect(action.configSchema.safeParse({}).success).toBe(false);
    expect(action.configSchema.safeParse({ labelId: '' }).success).toBe(false);
    expect(action.configSchema.parse({ labelId: 'label-1', ignored: true })).toEqual({ labelId: 'label-1' });
  });
});
